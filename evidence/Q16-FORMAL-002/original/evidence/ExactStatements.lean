import Q16Formal

/- Q16-FORMAL-002 supplemental typed consumers.
   Fixed against b99f5a4 / proof blob 84ea668446d4217b526fd12c64224743efb81954.
   These are the full intended propositions, not inferred types of declarations.
   Existing proof definitions, statements and audit files are unchanged. -/
open Q16Formal

example : ∀ (expanded divisor candidate : Nat),
    candidate * divisor ≤ expanded → expanded < (candidate + 1) * divisor →
    expanded / divisor = candidate := corrected_digit_is_quotient

example : ∀ (numerator divisor quotient remainder : Nat),
    0 < divisor → numerator = quotient * divisor + remainder → remainder < divisor →
    numerator / divisor = quotient := quotient_certificate_sound

example : ∀ (remainder digit divisor : Nat),
    0 < divisor → remainder < divisor → digit < radix →
    (remainder * radix + digit) / divisor < radix := radix_digit_lt

example : ∀ (remainder digit divisor : Nat),
    let expanded := remainder * radix + digit
    expanded = (expanded / divisor) * divisor + (expanded % divisor) := radix_step_decomposition

example : ∀ (remainder digit divisor : Nat), 0 < divisor →
    (remainder * radix + digit) % divisor < divisor := radix_step_remainder_bounded

example : ∀ (prefixValue quotient remainder digit divisor : Nat),
    prefixValue = quotient * divisor + remainder →
    prefixValue * radix + digit =
      (quotient * radix + (remainder * radix + digit) / divisor) * divisor +
        (remainder * radix + digit) % divisor := radix_prefix_invariant

example : ∀ (product divisor : Nat), 0 < divisor →
    (product - product % divisor) / divisor = product / divisor := exact_safe_product_path

example : ∀ (negative : Bool) (magnitude : Nat), magnitude ≤ magnitudeLimit negative →
    (-2147483648 : Int) ≤ signedMagnitude negative magnitude ∧
      signedMagnitude negative magnitude ≤ (2147483647 : Int) := checked_magnitude_within_int32

example : ∀ (negative : Bool), signedMagnitude negative 0 = 0 := zero_is_canonical

example : checkedSign false 2147483648 = none ∧
    checkedSign true 2147483648 = some (-2147483648) := sign_asymmetry

example : ∀ (remainder digit divisor : Nat), remainder < divisor → divisor ≤ 2147483648 →
    digit < radix → remainder * radix + digit < 140737488355328 := expanded_remainder_lt_2pow47

example : ∀ (digit divisor : Nat), digit < radix → divisor ≤ 2147483648 →
    digit * divisor < 140737488355328 := trial_product_lt_2pow47

example : ∀ (value : Nat), value ≤ 2147483647 →
    value * radix < 140737488355328 := scaled_radicand_lt_2pow47

example : ∀ (radicand root : Nat), root * root ≤ radicand →
    radicand < (root + 1) * (root + 1) → sqrtBracket radicand root := sqrt_certificate_is_bracket

-- Freeze the meaning of helper definitions as well as theorem propositions.
example : radix = 65536 := rfl
example : ∀ (negative : Bool),
    magnitudeLimit negative = (if negative then 2147483648 else 2147483647) := fun _ => rfl
example : ∀ (negative : Bool) (magnitude : Nat),
    signedMagnitude negative magnitude =
      (if negative then -(Int.ofNat magnitude) else Int.ofNat magnitude) := fun _ _ => rfl
example : ∀ (negative : Bool) (magnitude : Nat),
    checkedSign negative magnitude =
      (if magnitude ≤ magnitudeLimit negative then some (signedMagnitude negative magnitude) else none) := fun _ _ => rfl
example : ∀ (radicand root : Nat),
    sqrtBracket radicand root = (root * root ≤ radicand ∧ radicand < (root + 1) * (root + 1)) := fun _ _ => rfl

#eval IO.println "PASS: 14 full theorem propositions and 5 helper definition identities checked"
