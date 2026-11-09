import Lean

/-!
Q16-ECMA-001: a bounded integer projection of ECMA-262 ToUint32/ToInt32.
This is NOT a model of IEEE-754 Number, coercion from arbitrary JS values,
exceptions, loops, or the complete production mulDiv implementation.
-/

namespace Q16ECMA

def modulus : Int := 4294967296
def midpoint : Int := 2147483648

def uint32Word (x : Int) : Int := x % modulus

def int32Word (x : Int) : Int :=
  let word := uint32Word x
  if word >= midpoint then word - modulus else word

/-- Integer-domain projection is always in the uint32 range. -/
theorem uint32Word_bounds (x : Int) :
    0 ≤ uint32Word x ∧ uint32Word x < modulus := by
  unfold uint32Word modulus
  omega

/-- Integer-domain signed projection always fits signed int32. -/
theorem int32Word_bounds (x : Int) :
    -2147483648 ≤ int32Word x ∧ int32Word x ≤ 2147483647 := by
  obtain ⟨hlo, hhi⟩ := uint32Word_bounds x
  unfold int32Word
  by_cases h : uint32Word x ≥ midpoint
  · simp [h]
    unfold modulus midpoint at *
    omega
  · simp [h]
    unfold midpoint at *
    omega

/-- Sanitized unsigned inputs are unchanged by uint32 projection. -/
theorem uint32Word_checked_identity (x : Int)
    (hlo : 0 ≤ x) (hhi : x ≤ 4294967295) :
    uint32Word x = x := by
  unfold uint32Word modulus
  omega

/-- Sanitized signed input domain is unchanged by int32 projection. -/
theorem int32Word_checked_identity (x : Int)
    (hlo : -2147483648 ≤ x) (hhi : x ≤ 2147483647) :
    int32Word x = x := by
  unfold int32Word uint32Word modulus midpoint
  omega

/-- Concrete edge: unconstrained 32-bit coercion wraps the first invalid
signed positive integer; the JavaScript checked int32 API rejects it. -/
theorem out_of_checked_domain_wraps :
    int32Word 2147483648 = -2147483648 := by
  decide

end Q16ECMA
