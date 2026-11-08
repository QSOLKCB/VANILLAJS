import Lean

/-!
Q16-FORMAL-001: exact mathematical certificates for signed Q16.16
radix arithmetic. This models natural/integer mathematics, not JS
floating-point execution or historical authorship.
-/
namespace Q16Formal

def radix : Nat := 65536

def magnitudeLimit (negative : Bool) : Nat :=
  if negative then 2147483648 else 2147483647

def signedMagnitude (negative : Bool) (magnitude : Nat) : Int :=
  if negative then -(Int.ofNat magnitude) else Int.ofNat magnitude

def checkedSign (negative : Bool) (magnitude : Nat) : Option Int :=
  if magnitude ≤ magnitudeLimit negative then
    some (signedMagnitude negative magnitude)
  else none

/-- The exact correction inequalities identify the floor quotient. -/
theorem corrected_digit_is_quotient
    (expanded divisor candidate : Nat)
    (hlower : candidate * divisor ≤ expanded)
    (hupper : expanded < (candidate + 1) * divisor) :
    expanded / divisor = candidate :=
  Nat.div_eq_of_lt_le hlower hupper

/-- Exact quotient follows from a quotient/remainder certificate. -/
theorem quotient_certificate_sound
    (numerator divisor quotient remainder : Nat)
    (_hpositive : 0 < divisor)
    (hdecomp : numerator = quotient * divisor + remainder)
    (hrem : remainder < divisor) :
    numerator / divisor = quotient := by
  apply Nat.div_eq_of_lt_le
  · rw [hdecomp]
    omega
  · rw [hdecomp]
    simp only [Nat.add_mul, Nat.one_mul]
    omega

/-- A radix expansion produces a quotient digit strictly below radix. -/
theorem radix_digit_lt
    (remainder digit divisor : Nat)
    (hpositive : 0 < divisor)
    (hrem : remainder < divisor)
    (hdigit : digit < radix) :
    (remainder * radix + digit) / divisor < radix := by
  apply (Nat.div_lt_iff_lt_mul hpositive).2
  dsimp [radix] at *
  omega

/-- A radix division step has an exact quotient/remainder decomposition. -/
theorem radix_step_decomposition
    (remainder digit divisor : Nat) :
    let expanded := remainder * radix + digit
    expanded = (expanded / divisor) * divisor + (expanded % divisor) := by
  dsimp
  simpa [Nat.add_comm, Nat.mul_comm] using
    (Nat.mod_add_div (remainder * radix + digit) divisor).symm

/-- A positive divisor bounds every next remainder. -/
theorem radix_step_remainder_bounded
    (remainder digit divisor : Nat) (hpositive : 0 < divisor) :
    (remainder * radix + digit) % divisor < divisor :=
  Nat.mod_lt _ hpositive

/-- Appending one digit preserves the full prefix reconstruction invariant. -/
theorem radix_prefix_invariant
    (prefixValue quotient remainder digit divisor : Nat)
    (hprefix : prefixValue = quotient * divisor + remainder) :
    prefixValue * radix + digit =
    (quotient * radix + (remainder * radix + digit) / divisor) * divisor +
      (remainder * radix + digit) % divisor := by
  rw [hprefix]
  have hstep :
      remainder * radix + digit =
        ((remainder * radix + digit) / divisor) * divisor +
          (remainder * radix + digit) % divisor := by
    simpa [Nat.add_comm, Nat.mul_comm] using
      (Nat.mod_add_div (remainder * radix + digit) divisor).symm
  calc
    (quotient * divisor + remainder) * radix + digit =
        (quotient * radix) * divisor + (remainder * radix + digit) := by
      simp only [Nat.add_mul, Nat.mul_assoc, Nat.add_assoc]
      ac_rfl
    _ = (quotient * radix) * divisor +
          (((remainder * radix + digit) / divisor) * divisor +
            (remainder * radix + digit) % divisor) := by
      exact congrArg (fun x : Nat => (quotient * radix) * divisor + x) hstep
    _ = (quotient * radix + (remainder * radix + digit) / divisor) *
          divisor + (remainder * radix + digit) % divisor := by
      simp only [Nat.add_mul, Nat.add_assoc]

/-- Exact product-minus-remainder division equals integer division. -/
theorem exact_safe_product_path (product divisor : Nat) (hpositive : 0 < divisor) :
    (product - product % divisor) / divisor = product / divisor := by
  have h := Nat.mod_add_div product divisor
  have hsub : product - product % divisor = divisor * (product / divisor) := by
    omega
  rw [hsub]
  exact Nat.mul_div_cancel_left (product / divisor) hpositive

/-- The sign-aware accepted magnitude always fits signed int32. -/
theorem checked_magnitude_within_int32 (negative : Bool) (magnitude : Nat)
    (h : magnitude ≤ magnitudeLimit negative) :
    (-2147483648 : Int) ≤ signedMagnitude negative magnitude ∧
      signedMagnitude negative magnitude ≤ (2147483647 : Int) := by
  cases negative with
  | false =>
      simp [magnitudeLimit, signedMagnitude] at *
      omega
  | true =>
      simp [magnitudeLimit, signedMagnitude] at *
      omega

/-- Signed zero canonicalizes to zero, independent of the sign bit. -/
theorem zero_is_canonical (negative : Bool) :
    signedMagnitude negative 0 = 0 := by
  cases negative <;> rfl

/-- Signed int32 admits negative 2^31 but rejects positive 2^31. -/
theorem sign_asymmetry :
    checkedSign false 2147483648 = none ∧
      checkedSign true 2147483648 = some (-2147483648) := by
  decide

/-- Expanded remainder is strictly below 2^47 in the admitted range. -/
theorem expanded_remainder_lt_2pow47
    (remainder digit divisor : Nat)
    (hrem : remainder < divisor)
    (hdiv : divisor ≤ 2147483648)
    (hdigit : digit < radix) :
    remainder * radix + digit < 140737488355328 := by
  dsimp [radix] at *
  omega

/-- An exact corrected quotient digit times divisor is below 2^47. -/
theorem trial_product_lt_2pow47
    (digit divisor : Nat)
    (hdigit : digit < radix)
    (hdiv : divisor ≤ 2147483648) :
    digit * divisor < 140737488355328 := by
  have ha : digit ≤ 65535 := by dsimp [radix] at hdigit; omega
  have hb := Nat.mul_le_mul ha hdiv
  omega

/-- The nonnegative int32 scaled square-root input is below 2^47. -/
theorem scaled_radicand_lt_2pow47
    (value : Nat) (h : value ≤ 2147483647) :
    value * radix < 140737488355328 := by
  dsimp [radix]
  omega

/-- Explicit exact integer-square bracketing contract. -/
def sqrtBracket (radicand root : Nat) : Prop :=
  root * root ≤ radicand ∧ radicand < (root + 1) * (root + 1)

theorem sqrt_certificate_is_bracket
    (radicand root : Nat)
    (hlo : root * root ≤ radicand)
    (hhi : radicand < (root + 1) * (root + 1)) :
    sqrtBracket radicand root := ⟨hlo, hhi⟩

end Q16Formal

namespace UnrelatedNamespace
def injectedData : Nat := 17
end UnrelatedNamespace
