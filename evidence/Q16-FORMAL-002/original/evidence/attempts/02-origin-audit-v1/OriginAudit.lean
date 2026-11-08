import Q16Formal

/- Supplemental origin-module audit; no namespace selection or Prop filtering.
   collectAxioms inspects transitive dependencies, including data and opaque values.
   This command inspects the imported compiled environment; it is audit tooling,
   not a new mathematical proof. -/
open Lean Elab Command in
run_elab do
  let env ← getEnv
  let names := env.constants.fold (init := #[]) fun acc name _ =>
    match env.getModuleIdxFor? name with
    | some idx => if env.header.moduleNames[idx.toNat]! == `Q16Formal then acc.push name else acc
    | none => acc
  let names := names.qsort Name.lt
  let expectedTheorems := #[
    `Q16Formal.corrected_digit_is_quotient, `Q16Formal.quotient_certificate_sound,
    `Q16Formal.radix_digit_lt, `Q16Formal.radix_step_decomposition,
    `Q16Formal.radix_step_remainder_bounded, `Q16Formal.radix_prefix_invariant,
    `Q16Formal.exact_safe_product_path, `Q16Formal.checked_magnitude_within_int32,
    `Q16Formal.zero_is_canonical, `Q16Formal.sign_asymmetry,
    `Q16Formal.expanded_remainder_lt_2pow47, `Q16Formal.trial_product_lt_2pow47,
    `Q16Formal.scaled_radicand_lt_2pow47, `Q16Formal.sqrt_certificate_is_bracket
  ].qsort Name.lt
  let mut theorems := #[]
  unless names.size > 0 do throwError "empty origin-module inventory"
  for name in names do
    -- Collect trust dependencies before any classification by type/kind.
    let axioms ← collectAxioms name
    for ax in axioms do
      unless ax == `propext || ax == `Quot.sound do
        throwError "unapproved transitive axiom {ax} in {name}"
    let some info := env.find? name | throwError "missing declaration {name}"
    let kind ← match info with
      | .thmInfo _ => do theorems := theorems.push name; pure "theorem"
      | .defnInfo v => do
          unless v.safety == .safe do throwError "unsafe definition {name}"
          pure "definition"
      | .opaqueInfo _ => pure "opaque"
      | .axiomInfo _ => throwError "primitive axiom in project {name}"
      | _ => pure "generated/other"
    logInfo m!"ORIGIN Q16Formal | {name} | {kind} | axioms {axioms}"
  unless theorems == expectedTheorems do
    throwError "theorem set mismatch: {theorems}"
  logInfo m!"PASS: {names.size} origin declarations audited; exact 14-theorem set; only propext/Quot.sound allowed"
