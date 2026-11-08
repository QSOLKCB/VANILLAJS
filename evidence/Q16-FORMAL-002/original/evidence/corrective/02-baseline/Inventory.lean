import Q16Formal

/- Enumerate actual defining modules, including data and compiler helpers.
   No expected count, namespace filter, or theorem-name allowlist lives here. -/
open Lean Elab in
run_elab do
  let env ← getEnv
  let origin (n : Name) : String :=
    match env.getModuleIdxFor? n with
    | some idx => env.header.moduleNames[idx.toNat]!.toString
    | none => env.mainModule.toString
  let kind (c : ConstantInfo) : String := match c with
    | .axiomInfo _ => "axiom"
    | .defnInfo _ => "definition"
    | .thmInfo _ => "theorem"
    | .opaqueInfo _ => "opaque"
    | .quotInfo _ => "quotient_primitive"
    | .inductInfo _ => "inductive"
    | .ctorInfo _ => "constructor"
    | .recInfo _ => "recursor"
  let dependencies (c : ConstantInfo) : Array Name :=
    let fromType := c.type.getUsedConstants
    let fromValue := match c.value? (allowOpaque := true) with
      | some value => value.getUsedConstants
      | none => #[]
    (fromType ++ fromValue).qsort Name.lt
  let names := (env.constants.fold (init := #[]) fun acc n _ =>
    if origin n == "Q16Formal" then acc.push n else acc).qsort Name.lt
  let mut rows := #[]
  for n in names do
    let some c := env.find? n | throwError "Missing origin declaration {n}"
    let axioms ← collectAxioms n
    let pretty ← Meta.ppExpr c.type
    rows := rows.push <| Json.mkObj [
      ("name", toJson n.toString), ("module", toJson (origin n)),
      ("kind", toJson (kind c)), ("unsafe", toJson c.isUnsafe),
      ("partial", toJson c.isPartial),
      ("level_parameters", toJson (c.levelParams.map Name.toString)),
      ("type", toJson pretty.pretty), ("type_expr", toJson (reprStr c.type)),
      ("axioms", toJson (axioms.map Name.toString)),
      ("direct_dependencies", toJson ((dependencies c).map Name.toString))]
  -- Walk proof/type/data dependencies without a Prop-only filter.
  let mut pending := names.toList
  let mut seen : NameSet := {}
  let mut closure := #[]
  let mut fuel := 1000000
  while !pending.isEmpty do
    if fuel == 0 then throwError "Dependency traversal incomplete: fuel exhausted"
    fuel := fuel - 1
    let n := pending.head!
    pending := pending.tail!
    if seen.contains n then continue
    seen := seen.insert n
    let some c := env.find? n | throwError "Missing dependency {n}"
    pending := (dependencies c).toList ++ pending
    closure := closure.push <| Json.mkObj [
      ("name", toJson n.toString), ("module", toJson (origin n)),
      ("kind", toJson (kind c)), ("unsafe", toJson c.isUnsafe),
      ("partial", toJson c.isPartial)]
  let report := Json.mkObj [
    ("schema", toJson "qsol.q16.origin-inventory.v2"),
    ("audited_modules", toJson #["Q16Formal"]),
    ("declarations", Json.arr rows), ("dependency_closure", Json.arr closure)]
  IO.println report.compress
