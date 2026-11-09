import Q16ECMA

/-! Typed, transitive axiom audit for the *integer projection only*. -/

#check Q16ECMA.uint32Word_bounds
#check Q16ECMA.int32Word_bounds
#check Q16ECMA.uint32Word_checked_identity
#check Q16ECMA.int32Word_checked_identity
#check Q16ECMA.out_of_checked_domain_wraps

#print axioms Q16ECMA.uint32Word_bounds
#print axioms Q16ECMA.int32Word_bounds
#print axioms Q16ECMA.uint32Word_checked_identity
#print axioms Q16ECMA.int32Word_checked_identity
#print axioms Q16ECMA.out_of_checked_domain_wraps
