-- SPDX-License-Identifier: Apache-2.0
import Lean
import Init.Data.Rat.Lemmas

/- ALIEN-MATH-006 mathematical models, not ECMAScript operational semantics. -/
set_option maxHeartbeats 2000000
set_option maxRecDepth 4096
namespace AlienMath006

inductive D4 where
  | e | r | r2 | r3 | s | rs | r2s | r3s
  deriving DecidableEq, Repr
open D4

def compose : D4 → D4 → D4
  | .e, .e => .e
  | .e, .r => .r
  | .e, .r2 => .r2
  | .e, .r3 => .r3
  | .e, .s => .s
  | .e, .rs => .rs
  | .e, .r2s => .r2s
  | .e, .r3s => .r3s
  | .r, .e => .r
  | .r, .r => .r2
  | .r, .r2 => .r3
  | .r, .r3 => .e
  | .r, .s => .rs
  | .r, .rs => .r2s
  | .r, .r2s => .r3s
  | .r, .r3s => .s
  | .r2, .e => .r2
  | .r2, .r => .r3
  | .r2, .r2 => .e
  | .r2, .r3 => .r
  | .r2, .s => .r2s
  | .r2, .rs => .r3s
  | .r2, .r2s => .s
  | .r2, .r3s => .rs
  | .r3, .e => .r3
  | .r3, .r => .e
  | .r3, .r2 => .r
  | .r3, .r3 => .r2
  | .r3, .s => .r3s
  | .r3, .rs => .s
  | .r3, .r2s => .rs
  | .r3, .r3s => .r2s
  | .s, .e => .s
  | .s, .r => .r3s
  | .s, .r2 => .r2s
  | .s, .r3 => .rs
  | .s, .s => .e
  | .s, .rs => .r3
  | .s, .r2s => .r2
  | .s, .r3s => .r
  | .rs, .e => .rs
  | .rs, .r => .s
  | .rs, .r2 => .r3s
  | .rs, .r3 => .r2s
  | .rs, .s => .r
  | .rs, .rs => .e
  | .rs, .r2s => .r3
  | .rs, .r3s => .r2
  | .r2s, .e => .r2s
  | .r2s, .r => .rs
  | .r2s, .r2 => .s
  | .r2s, .r3 => .r3s
  | .r2s, .s => .r2
  | .r2s, .rs => .r
  | .r2s, .r2s => .e
  | .r2s, .r3s => .r3
  | .r3s, .e => .r3s
  | .r3s, .r => .r2s
  | .r3s, .r2 => .rs
  | .r3s, .r3 => .s
  | .r3s, .s => .r3
  | .r3s, .rs => .r2
  | .r3s, .r2s => .r
  | .r3s, .r3s => .e

def inverse : D4 → D4
  | .r => .r3
  | .r3 => .r
  | g => g

def act (g : D4) (p : Rat × Rat) : Rat × Rat :=
  match g with
  | .e => p
  | .r => (-p.2, p.1)
  | .r2 => (-p.1, -p.2)
  | .r3 => (p.2, -p.1)
  | .s => (p.1, -p.2)
  | .rs => (p.2, p.1)
  | .r2s => (-p.1, p.2)
  | .r3s => (-p.2, -p.1)

def determinant (g : D4) : Rat :=
  match g with
  | .e | .r | .r2 | .r3 => 1
  | _ => -1

def distanceSq (p q : Rat × Rat) : Rat :=
  (p.1-q.1)*(p.1-q.1)+(p.2-q.2)*(p.2-q.2)

def area (p q t : Rat × Rat) : Rat :=
  (q.1-p.1)*(t.2-p.2)-(q.2-p.2)*(t.1-p.1)

def relabel {α β : Type} (adj : α → α → Bool) (p : β → α) : β → β → Bool :=
  fun i j => adj (p i) (p j)

inductive Vertex3 where
  | a | b | c
  deriving DecidableEq
inductive Perm3 where
  | abc | acb | bac | bca | cab | cba
  deriving DecidableEq
structure Graph3 where
  ab : Bool
  ac : Bool
  bc : Bool
  deriving DecidableEq

def perm3 : Perm3 → Vertex3 → Vertex3
  | .abc, .a => .a
  | .abc, .b => .b
  | .abc, .c => .c
  | .acb, .a => .a
  | .acb, .b => .c
  | .acb, .c => .b
  | .bac, .a => .b
  | .bac, .b => .a
  | .bac, .c => .c
  | .bca, .a => .b
  | .bca, .b => .c
  | .bca, .c => .a
  | .cab, .a => .c
  | .cab, .b => .a
  | .cab, .c => .b
  | .cba, .a => .c
  | .cba, .b => .b
  | .cba, .c => .a

def adjacency3 (g : Graph3) : Vertex3 → Vertex3 → Bool
  | .a, .b | .b, .a => g.ab
  | .a, .c | .c, .a => g.ac
  | .b, .c | .c, .b => g.bc
  | _, _ => false

def relabel3 (g : Graph3) (p : Perm3) : Graph3 :=
  ⟨adjacency3 g (perm3 p .a) (perm3 p .b),
   adjacency3 g (perm3 p .a) (perm3 p .c),
   adjacency3 g (perm3 p .b) (perm3 p .c)⟩
def bit (b : Bool) : Int := if b then 1 else 0
def polynomial3 (g : Graph3) : List Int :=
  [1, 0, -(bit g.ab + bit g.ac + bit g.bc), -2*bit g.ab*bit g.ac*bit g.bc]
def evalPolynomial3 (g : Graph3) (x : Int) : Int :=
  (polynomial3 g).foldl (fun accumulator coefficient => accumulator*x+coefficient) 0
def detLambda3 (g : Graph3) (x : Int) : Int :=
  let a := bit g.ab; let b := bit g.ac; let c := bit g.bc
  x*(x*x-(-c)*(-c))-(-a)*((-a)*x-(-c)*(-b))+(-b)*((-a)*(-c)-x*(-b))

theorem rational_add_comm : ∀ a b : Rat, a+b=b+a := by
  intros; grind

theorem rational_add_assoc : ∀ a b c : Rat, (a+b)+c=a+(b+c) := by
  intros; grind

theorem rational_mul_comm : ∀ a b : Rat, a*b=b*a := by
  intros; grind

theorem rational_distributive : ∀ a b c : Rat, a*(b+c)=a*b+a*c := by
  intros; grind

theorem normalization_certificate : ∀ n d a b g : Int,
    n=a*g → d=b*g → n*b=a*d := by
  intros; grind

theorem q16_floor_certificate : ∀ n d q : Nat,
    q*d ≤ 65536*n → 65536*n < (q+1)*d → (65536*n)/d=q := by
  intro n d q hl hu
  exact Nat.div_eq_of_lt_le hl hu

theorem q16_exact_magnitude : ∀ n : Nat, (n*65536)/65536=n := by
  intro n
  exact Nat.mul_div_cancel n (by decide)

theorem interval_reflection : ∀ lo hi x : Rat,
    (-hi ≤ -x ∧ -x ≤ -lo) ↔ (lo ≤ x ∧ x ≤ hi) := by
  intros; grind

theorem d4_left_identity : ∀ g : D4, compose .e g=g := by
  intro g; cases g <;> rfl

theorem d4_right_identity : ∀ g : D4, compose g .e=g := by
  intro g; cases g <;> rfl

theorem d4_associative : ∀ a b c : D4, compose (compose a b) c=compose a (compose b c) := by
  intro a b c; cases a <;> cases b <;> cases c <;> rfl

theorem d4_inverse : ∀ g : D4, compose (inverse g) g=.e ∧ compose g (inverse g)=.e := by
  intro g; cases g <;> decide

theorem d4_action_compose : ∀ a b : D4, ∀ p : Rat × Rat,
    act (compose a b) p=act a (act b p) := by
  intro a b p; cases a <;> cases b <;> simp [compose, act, Rat.neg_neg]

theorem d4_distance : ∀ g : D4, ∀ p q : Rat × Rat,
    distanceSq (act g p) (act g q)=distanceSq p q := by
  intro g p q; cases g <;> simp only [act, distanceSq] <;> grind

theorem d4_area : ∀ g : D4, ∀ p q t : Rat × Rat,
    area (act g p) (act g q) (act g t)=determinant g * area p q t := by
  intro g p q t; cases g <;> simp only [act, area, determinant] <;> grind

theorem relabel_symmetry : ∀ (α β : Type) (adj : α → α → Bool) (p : β → α),
    (∀ i j, adj i j=adj j i) → ∀ i j, relabel adj p i j=relabel adj p j i := by
  intro α β adj p h i j; exact h (p i) (p j)

theorem relabel_no_loops : ∀ (α β : Type) (adj : α → α → Bool) (p : β → α),
    (∀ i, adj i i=false) → ∀ i, relabel adj p i i=false := by
  intro α β adj p h i; exact h (p i)

theorem relabel_compose : ∀ (α β γ : Type) (adj : α → α → Bool) (p : β → α) (q : γ → β),
    relabel (relabel adj p) q=relabel adj (fun i => p (q i)) := by
  intros; rfl

theorem relabel_inverse : ∀ (α : Type) (adj : α → α → Bool) (p q : α → α),
    (∀ i, p (q i)=i) → relabel (relabel adj p) q=adj := by
  intro α adj p q h
  funext i j
  simp [relabel, h]

theorem graph3_determinant : ∀ g : Graph3, ∀ x : Int, detLambda3 g x=evalPolynomial3 g x := by
  intro ⟨a,b,c⟩ x
  cases a <;> cases b <;> cases c <;> simp [detLambda3, evalPolynomial3, polynomial3, List.foldl, bit] <;> grind

theorem graph3_spectral_relabel : ∀ g : Graph3, ∀ p : Perm3,
    polynomial3 (relabel3 g p)=polynomial3 g := by
  intro ⟨a,b,c⟩ p
  cases a <;> cases b <;> cases c <;> cases p <;> decide

end AlienMath006
