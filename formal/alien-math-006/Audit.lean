-- SPDX-License-Identifier: Apache-2.0
import AlienMath006
open AlienMath006

-- These independently pinned types prevent accepting a weakened theorem.
example : ∀ a b : Rat, a+b=b+a := AlienMath006.rational_add_comm
#print axioms AlienMath006.rational_add_comm

example : ∀ a b c : Rat, (a+b)+c=a+(b+c) := AlienMath006.rational_add_assoc
#print axioms AlienMath006.rational_add_assoc

example : ∀ a b : Rat, a*b=b*a := AlienMath006.rational_mul_comm
#print axioms AlienMath006.rational_mul_comm

example : ∀ a b c : Rat, a*(b+c)=a*b+a*c := AlienMath006.rational_distributive
#print axioms AlienMath006.rational_distributive

example : ∀ n d a b g : Int,
    n=a*g → d=b*g → n*b=a*d := AlienMath006.normalization_certificate
#print axioms AlienMath006.normalization_certificate

example : ∀ n d q : Nat,
    q*d ≤ 65536*n → 65536*n < (q+1)*d → (65536*n)/d=q := AlienMath006.q16_floor_certificate
#print axioms AlienMath006.q16_floor_certificate

example : ∀ n : Nat, (n*65536)/65536=n := AlienMath006.q16_exact_magnitude
#print axioms AlienMath006.q16_exact_magnitude

example : ∀ lo hi x : Rat,
    (-hi ≤ -x ∧ -x ≤ -lo) ↔ (lo ≤ x ∧ x ≤ hi) := AlienMath006.interval_reflection
#print axioms AlienMath006.interval_reflection

example : ∀ g : D4, compose .e g=g := AlienMath006.d4_left_identity
#print axioms AlienMath006.d4_left_identity

example : ∀ g : D4, compose g .e=g := AlienMath006.d4_right_identity
#print axioms AlienMath006.d4_right_identity

example : ∀ a b c : D4, compose (compose a b) c=compose a (compose b c) := AlienMath006.d4_associative
#print axioms AlienMath006.d4_associative

example : ∀ g : D4, compose (inverse g) g=.e ∧ compose g (inverse g)=.e := AlienMath006.d4_inverse
#print axioms AlienMath006.d4_inverse

example : ∀ a b : D4, ∀ p : Rat × Rat,
    act (compose a b) p=act a (act b p) := AlienMath006.d4_action_compose
#print axioms AlienMath006.d4_action_compose

example : ∀ g : D4, ∀ p q : Rat × Rat,
    distanceSq (act g p) (act g q)=distanceSq p q := AlienMath006.d4_distance
#print axioms AlienMath006.d4_distance

example : ∀ g : D4, ∀ p q t : Rat × Rat,
    area (act g p) (act g q) (act g t)=determinant g * area p q t := AlienMath006.d4_area
#print axioms AlienMath006.d4_area

example : ∀ (α β : Type) (adj : α → α → Bool) (p : β → α),
    (∀ i j, adj i j=adj j i) → ∀ i j, relabel adj p i j=relabel adj p j i := AlienMath006.relabel_symmetry
#print axioms AlienMath006.relabel_symmetry

example : ∀ (α β : Type) (adj : α → α → Bool) (p : β → α),
    (∀ i, adj i i=false) → ∀ i, relabel adj p i i=false := AlienMath006.relabel_no_loops
#print axioms AlienMath006.relabel_no_loops

example : ∀ (α β γ : Type) (adj : α → α → Bool) (p : β → α) (q : γ → β),
    relabel (relabel adj p) q=relabel adj (fun i => p (q i)) := AlienMath006.relabel_compose
#print axioms AlienMath006.relabel_compose

example : ∀ (α : Type) (adj : α → α → Bool) (p q : α → α),
    (∀ i, p (q i)=i) → relabel (relabel adj p) q=adj := AlienMath006.relabel_inverse
#print axioms AlienMath006.relabel_inverse

example : ∀ g : Graph3, ∀ x : Int, detLambda3 g x=evalPolynomial3 g x := AlienMath006.graph3_determinant
#print axioms AlienMath006.graph3_determinant

example : ∀ g : Graph3, ∀ p : Perm3,
    polynomial3 (relabel3 g p)=polynomial3 g := AlienMath006.graph3_spectral_relabel
#print axioms AlienMath006.graph3_spectral_relabel
