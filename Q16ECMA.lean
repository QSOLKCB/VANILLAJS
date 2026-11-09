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
  constructor
  · exact Int.emod_nonneg x (by decide)
  · exact Int.emod_lt_of_pos x (by decide)

private theorem int32Projection_bounds (word : Int)
    (hlo : 0 ≤ word) (hhi : word < 4294967296) :
    -2147483648 ≤ (if word ≥ 2147483648 then word - 4294967296 else word) ∧
      (if word ≥ 2147483648 then word - 4294967296 else word) ≤ 2147483647 := by
  cases (inferInstance : Decidable (word ≥ 2147483648)) with
  | isTrue h =>
    rw [ite_eq_left h]
    constructor
    · have hShift : (-2147483648 : Int) + 4294967296 ≤
          (word - 4294967296) + 4294967296 := by
        rw [Int.sub_add_cancel]
        have hConst : (-2147483648 : Int) + 4294967296 = 2147483648 := by decide
        rw [hConst]
        exact h
      exact Int.le_of_add_le_add_right hShift
    · have hConst : (4294967295 : Int) + 1 = 4294967296 := by decide
      have hWord : word ≤ 4294967295 := Int.le_of_lt_add_one (by
        rw [hConst]
        exact hhi)
      have hLimit : (4294967295 : Int) ≤ 2147483647 + 4294967296 := by decide
      have hUpper : word ≤ 2147483647 + 4294967296 := Int.le_trans hWord hLimit
      have hShift : (word - 4294967296) + 4294967296 ≤
          (2147483647 : Int) + 4294967296 := by
        rw [Int.sub_add_cancel]
        exact hUpper
      exact Int.le_of_add_le_add_right hShift
  | isFalse h =>
    rw [ite_eq_right h]
    constructor
    · exact Int.le_trans (by decide) hlo
    · have hLT : word < 2147483648 := Int.lt_of_not_ge h
      have hConst : (2147483647 : Int) + 1 = 2147483648 := by decide
      have hLT' : word < (2147483647 : Int) + 1 := by
        rw [hConst]
        exact hLT
      exact Int.le_of_lt_add_one hLT'

/-- Integer-domain signed projection always fits signed int32. -/
theorem int32Word_bounds (x : Int) :
    -2147483648 ≤ int32Word x ∧ int32Word x ≤ 2147483647 := by
  obtain ⟨hlo, hhi⟩ := uint32Word_bounds x
  change -2147483648 ≤
      (if uint32Word x ≥ midpoint then uint32Word x - modulus else uint32Word x) ∧
    (if uint32Word x ≥ midpoint then uint32Word x - modulus else uint32Word x) ≤
      2147483647
  exact int32Projection_bounds (uint32Word x) hlo (by simpa [modulus] using hhi)

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
  change (if x % 4294967296 ≥ 2147483648 then
    x % 4294967296 - 4294967296
    else x % 4294967296) = x
  by_cases h : x % 4294967296 ≥ 2147483648
  · simp [h]
    omega
  · simp [h]
    omega

/-- Concrete edge: unconstrained 32-bit coercion wraps the first invalid
signed positive integer; the JavaScript checked int32 API rejects it. -/
theorem out_of_checked_domain_wraps :
    int32Word 2147483648 = -2147483648 := by
  decide

end Q16ECMA
