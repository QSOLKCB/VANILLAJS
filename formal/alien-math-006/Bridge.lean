-- SPDX-License-Identifier: Apache-2.0
import AlienMath006
open AlienMath006
deriving instance Inhabited for D4
deriving instance Inhabited for Perm3

-- Frozen finite model domain; compared with independently encoded JSON inputs.
def groups : Array D4 := #[.e,.r,.r2,.r3,.s,.rs,.r2s,.r3s]
def groupIndex (g : D4) : Nat :=
  match g with
  | .e => 0 | .r => 1 | .r2 => 2 | .r3 => 3 | .s => 4 | .rs => 5 | .r2s => 6 | .r3s => 7
def points : Array (Rat × Rat) := #[(0,0),(1/3,-2/5),(-7/11,13/17),(2,3)]
def permutations : Array Perm3 := #[.abc,.acb,.bac,.bca,.cab,.cba]
def graphFromMask (m : Nat) : Graph3 := ⟨m%2=1, m/2%2=1, m/4%2=1⟩
def graphMask (g : Graph3) : Nat := (if g.ab then 1 else 0)+(if g.ac then 2 else 0)+(if g.bc then 4 else 0)
def polynomialText (g : Graph3) : String := String.intercalate "," ((polynomial3 g).map toString)
def main : IO Unit := do
  let values := points.flatMap (fun p => #[p.1,p.2])
  for i in [:values.size] do
    for j in [:values.size] do
      let a := values[i]!; let b := values[j]!
      let quotient := if b=0 then "reject-zero" else toString (a/b)
      IO.println s!"ARITH|{i}|{j}|{a+b}|{a-b}|{a*b}|{quotient}"
  for i in [:groups.size] do
    let g := groups[i]!
    for j in [:groups.size] do
      IO.println s!"D4|{i}|{j}|{groupIndex (compose g groups[j]!)}"
    for j in [:points.size] do
      let p := act g points[j]!
      IO.println s!"ACTION|{i}|{j}|{p.1}|{p.2}"
      for k in [:points.size] do
        let q := act g points[k]!
        IO.println s!"DIST|{i}|{j}|{k}|{distanceSq p q}"
        for l in [:points.size] do
          IO.println s!"AREA|{i}|{j}|{k}|{l}|{area p q (act g points[l]!)}"
  for mask in [:8] do
    let g := graphFromMask mask
    IO.println s!"GRAPH3|{mask}|{polynomialText g}"
    for j in [:permutations.size] do
      let h := relabel3 g permutations[j]!
      IO.println s!"RELABEL3|{mask}|{j}|{graphMask h}|{polynomialText h}"
