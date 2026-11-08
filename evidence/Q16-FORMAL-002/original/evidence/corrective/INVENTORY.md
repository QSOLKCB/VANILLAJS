# Complete pinned declaration inventory

Frozen source: `b99f5a4af17babe1215bc36872a18a4c72714faf`; proof blob: `84ea668446d4217b526fd12c64224743efb81954`.

This is a reviewed expected inventory for Lean 4.35.0, not a compiler-wide count assumption. The acceptance gate compares the exact module, name, kind, type AST, universes, dependency list and axiom record. The observed inventory is enumerated by defining module without an expected count or namespace filter.

31 declarations: 14 specified theorems, 12 generated auxiliary lemmas, 5 definitions. No unexpected declarations. All have actual origin module `Q16Formal`. Full machine-readable types and exact expression trees are in [expected-inventory.json](expected-inventory.json); fresh observations are in [04-target/inventory.json](04-target/inventory.json) and [08-target-repro/inventory.json](08-target-repro/inventory.json).

## 1. `Q16Formal.checkedSign`

- Kind: definition; class: definition.
- Origin: `Q16Formal`; source parent: `Q16Formal.checkedSign` ([line 18](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L18)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
Bool → Nat → Option Int
```

## 2. `Q16Formal.checked_magnitude_within_int32`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.checked_magnitude_within_int32` ([line 108](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L108)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (negative : Bool) (magnitude : Nat),
  magnitude ≤ Q16Formal.magnitudeLimit negative →
    -2147483648 ≤ Q16Formal.signedMagnitude negative magnitude ∧
      Q16Formal.signedMagnitude negative magnitude ≤ 2147483647
```

## 3. `Q16Formal.corrected_digit_is_quotient`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.corrected_digit_is_quotient` ([line 24](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L24)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext.

```lean
∀ (expanded divisor candidate : Nat),
  candidate * divisor ≤ expanded → expanded < (candidate + 1) * divisor → expanded / divisor = candidate
```

## 4. `Q16Formal.exact_safe_product_path`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.exact_safe_product_path` ([line 99](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L99)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (product divisor : Nat), 0 < divisor → (product - product % divisor) / divisor = product / divisor
```

## 5. `Q16Formal.expanded_remainder_lt_2pow47`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.expanded_remainder_lt_2pow47` ([line 132](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L132)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (remainder digit divisor : Nat),
  remainder < divisor →
    divisor ≤ 2147483648 → digit < Q16Formal.radix → remainder * Q16Formal.radix + digit < 140737488355328
```

## 6. `Q16Formal.magnitudeLimit`

- Kind: definition; class: definition.
- Origin: `Q16Formal`; source parent: `Q16Formal.magnitudeLimit` ([line 12](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L12)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
Bool → Nat
```

## 7. `Q16Formal.quotient_certificate_sound`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.quotient_certificate_sound` ([line 32](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L32)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (numerator divisor quotient remainder : Nat),
  0 < divisor → numerator = quotient * divisor + remainder → remainder < divisor → numerator / divisor = quotient
```

## 8. `Q16Formal.radix`

- Kind: definition; class: definition.
- Origin: `Q16Formal`; source parent: `Q16Formal.radix` ([line 10](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L10)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
Nat
```

## 9. `Q16Formal.radix_digit_lt`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.radix_digit_lt` ([line 46](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L46)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (remainder digit divisor : Nat),
  0 < divisor →
    remainder < divisor → digit < Q16Formal.radix → (remainder * Q16Formal.radix + digit) / divisor < Q16Formal.radix
```

## 10. `Q16Formal.radix_prefix_invariant`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.radix_prefix_invariant` ([line 72](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L72)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (prefixValue quotient remainder digit divisor : Nat),
  prefixValue = quotient * divisor + remainder →
    prefixValue * Q16Formal.radix + digit =
      (quotient * Q16Formal.radix + (remainder * Q16Formal.radix + digit) / divisor) * divisor +
        (remainder * Q16Formal.radix + digit) % divisor
```

## 11. `Q16Formal.radix_step_decomposition`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.radix_step_decomposition` ([line 57](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L57)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext.

```lean
∀ (remainder digit divisor : Nat),
  have expanded := remainder * Q16Formal.radix + digit;
  expanded = expanded / divisor * divisor + expanded % divisor
```

## 12. `Q16Formal.radix_step_remainder_bounded`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.radix_step_remainder_bounded` ([line 66](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L66)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
∀ (remainder digit divisor : Nat), 0 < divisor → (remainder * Q16Formal.radix + digit) % divisor < divisor
```

## 13. `Q16Formal.scaled_radicand_lt_2pow47`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.scaled_radicand_lt_2pow47` ([line 152](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L152)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (value : Nat), value ≤ 2147483647 → value * Q16Formal.radix < 140737488355328
```

## 14. `Q16Formal.sign_asymmetry`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.sign_asymmetry` ([line 126](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L126)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
Q16Formal.checkedSign false 2147483648 = none ∧ Q16Formal.checkedSign true 2147483648 = some (-2147483648)
```

## 15. `Q16Formal.signedMagnitude`

- Kind: definition; class: definition.
- Origin: `Q16Formal`; source parent: `Q16Formal.signedMagnitude` ([line 15](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L15)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
Bool → Nat → Int
```

## 16. `Q16Formal.sqrtBracket`

- Kind: definition; class: definition.
- Origin: `Q16Formal`; source parent: `Q16Formal.sqrtBracket` ([line 159](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L159)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
Nat → Nat → Prop
```

## 17. `Q16Formal.sqrt_certificate_is_bracket`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.sqrt_certificate_is_bracket` ([line 162](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L162)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
∀ (radicand root : Nat),
  root * root ≤ radicand → radicand < (root + 1) * (root + 1) → Q16Formal.sqrtBracket radicand root
```

## 18. `Q16Formal.trial_product_lt_2pow47`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.trial_product_lt_2pow47` ([line 142](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L142)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (digit divisor : Nat), digit < Q16Formal.radix → divisor ≤ 2147483648 → digit * divisor < 140737488355328
```

## 19. `Q16Formal.zero_is_canonical`

- Kind: theorem; class: specified_theorem.
- Origin: `Q16Formal`; source parent: `Q16Formal.zero_is_canonical` ([line 121](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L121)).
- Relationship: Explicit frozen source declaration; full type checked by ExactStatements.lean.
- Transitive axioms: none.

```lean
∀ (negative : Bool), Q16Formal.signedMagnitude negative 0 = 0
```

## 20. `Q16Formal.checked_magnitude_within_int32._proof_1_3`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.checked_magnitude_within_int32` ([line 108](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L108)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (magnitude : Nat), magnitude ≤ 2147483647 → ¬↑magnitude ≤ 2147483647 → False
```

## 21. `Q16Formal.checked_magnitude_within_int32._proof_1_4`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.checked_magnitude_within_int32` ([line 108](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L108)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (magnitude : Nat), magnitude ≤ 2147483648 → ¬↑magnitude ≤ 2147483648 → False
```

## 22. `Q16Formal.exact_safe_product_path._proof_1_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.exact_safe_product_path` ([line 99](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L99)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (product divisor : Nat),
  product % divisor + divisor * (product / divisor) = product →
    ¬product - product % divisor = divisor * (product / divisor) → False
```

## 23. `Q16Formal.expanded_remainder_lt_2pow47._proof_1_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.expanded_remainder_lt_2pow47` ([line 132](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L132)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (remainder digit divisor : Nat),
  remainder < divisor → divisor ≤ 2147483648 → digit < 65536 → ¬remainder * 65536 + digit < 140737488355328 → False
```

## 24. `Q16Formal.magnitudeLimit.eq_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.magnitudeLimit` ([line 12](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L12)).
- Relationship: Definitional equation lemma for the parent definition.
- Transitive axioms: none.

```lean
∀ (negative : Bool), Q16Formal.magnitudeLimit negative = if negative = true then 2147483648 else 2147483647
```

## 25. `Q16Formal.quotient_certificate_sound._proof_1_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.quotient_certificate_sound` ([line 32](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L32)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (numerator divisor quotient remainder : Nat), ¬quotient * divisor ≤ quotient * divisor + remainder → False
```

## 26. `Q16Formal.quotient_certificate_sound._proof_1_2`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.quotient_certificate_sound` ([line 32](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L32)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (numerator divisor quotient remainder : Nat),
  remainder < divisor → ¬quotient * divisor + remainder < quotient * divisor + divisor → False
```

## 27. `Q16Formal.radix_digit_lt._proof_1_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.radix_digit_lt` ([line 46](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L46)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (remainder digit divisor : Nat),
  remainder < divisor → digit < 65536 → ¬remainder * 65536 + digit < 65536 * divisor → False
```

## 28. `Q16Formal.scaled_radicand_lt_2pow47._proof_1_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.scaled_radicand_lt_2pow47` ([line 152](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L152)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (value : Nat), value ≤ 2147483647 → ¬value * 65536 < 140737488355328 → False
```

## 29. `Q16Formal.signedMagnitude.eq_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.signedMagnitude` ([line 15](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L15)).
- Relationship: Definitional equation lemma for the parent definition.
- Transitive axioms: none.

```lean
∀ (negative : Bool) (magnitude : Nat),
  Q16Formal.signedMagnitude negative magnitude = if negative = true then -Int.ofNat magnitude else Int.ofNat magnitude
```

## 30. `Q16Formal.trial_product_lt_2pow47._proof_1_1`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.trial_product_lt_2pow47` ([line 142](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L142)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (digit divisor : Nat), digit < 65536 → ¬digit ≤ 65535 → False
```

## 31. `Q16Formal.trial_product_lt_2pow47._proof_1_2`

- Kind: theorem; class: generated_auxiliary_lemma.
- Origin: `Q16Formal`; source parent: `Q16Formal.trial_product_lt_2pow47` ([line 142](https://github.com/QSOLKCB/VANILLAJS/blob/b99f5a4af17babe1215bc36872a18a4c72714faf/Q16Formal.lean#L142)).
- Relationship: Omega-generated contradiction lemma supporting the parent proof; not a separate user-authored claim.
- Transitive axioms: propext, Quot.sound.

```lean
∀ (digit divisor : Nat), digit * divisor ≤ 65535 * 2147483648 → ¬digit * divisor < 140737488355328 → False
```

## Reachable dependency closure

1,706 constants are reachable through declaration types and values. The origin inventory contains no opaque declaration. The closure includes one explicitly reviewed opaque standard-library data helper, `String.Internal.append`, with no transitive axioms. Its exact type, kernel default-value body, defining module and dependencies are pinned. All other opaque dependencies are rejected.

Observed path: `Q16Formal.checked_magnitude_within_int32._proof_1_3` → `Lean.Omega.LinearCombo.coordinate_eval_0` → `Lean.Omega.IntList.get_cons_zero` → `List.instGetElem?NatLtLength` → `List.get!Internal` → `List.get!Internal._f` → `panicWithPosWithDecl` → `mkPanicMessageWithDecl` → `String.Internal.append`.

The helper supports panic-message construction in the imported library. It is not an admitted proposition. Its external runtime implementation is not claimed formally verified. Only `propext` (propositional extensionality) and `Quot.sound` (quotient soundness) occur as logical axioms. No `sorryAx`, `Classical.choice`, undeclared project axiom, unsafe dependency or partial definition occurs in the accepted closure.
