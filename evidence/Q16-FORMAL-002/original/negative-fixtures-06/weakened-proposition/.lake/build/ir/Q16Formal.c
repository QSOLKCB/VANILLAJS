// Lean compiler output
// Module: Q16Formal
// Imports: public import Init public meta import Init public import Lean
#include <lean/lean.h>
#if defined(__clang__)
#pragma clang diagnostic ignored "-Wunused-parameter"
#pragma clang diagnostic ignored "-Wunused-label"
#elif defined(__GNUC__) && !defined(__CLANG__)
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wunused-label"
#pragma GCC diagnostic ignored "-Wunused-but-set-variable"
#endif
#ifdef __cplusplus
extern "C" {
#endif
lean_object* lean_nat_to_int(lean_object*);
lean_object* lean_int_neg(lean_object*);
uint8_t lean_nat_dec_le(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_radix;
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_magnitudeLimit(uint8_t);
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_magnitudeLimit___boxed(lean_object*);
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_signedMagnitude(uint8_t, lean_object*);
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_signedMagnitude___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_checkedSign(uint8_t, lean_object*);
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_checkedSign___boxed(lean_object*, lean_object*);
static lean_object* _init_lp_vanillajs__q16__proof_Q16Formal_radix(void){
_start:
{
lean_object* v___x_1_; 
v___x_1_ = lean_unsigned_to_nat(65536u);
return v___x_1_;
}
}
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_magnitudeLimit(uint8_t v_negative_2_){
_start:
{
if (v_negative_2_ == 0)
{
lean_object* v___x_3_; 
v___x_3_ = lean_unsigned_to_nat(2147483647u);
return v___x_3_;
}
else
{
lean_object* v___x_4_; 
v___x_4_ = lean_unsigned_to_nat(2147483648u);
return v___x_4_;
}
}
}
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_magnitudeLimit___boxed(lean_object* v_negative_5_){
_start:
{
uint8_t v_negative_boxed_6_; lean_object* v_res_7_; 
v_negative_boxed_6_ = lean_unbox(v_negative_5_);
v_res_7_ = lp_vanillajs__q16__proof_Q16Formal_magnitudeLimit(v_negative_boxed_6_);
return v_res_7_;
}
}
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_signedMagnitude(uint8_t v_negative_8_, lean_object* v_magnitude_9_){
_start:
{
if (v_negative_8_ == 0)
{
lean_object* v___x_10_; 
v___x_10_ = lean_nat_to_int(v_magnitude_9_);
return v___x_10_;
}
else
{
lean_object* v___x_11_; lean_object* v___x_12_; 
v___x_11_ = lean_nat_to_int(v_magnitude_9_);
v___x_12_ = lean_int_neg(v___x_11_);
lean_dec(v___x_11_);
return v___x_12_;
}
}
}
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_signedMagnitude___boxed(lean_object* v_negative_13_, lean_object* v_magnitude_14_){
_start:
{
uint8_t v_negative_boxed_15_; lean_object* v_res_16_; 
v_negative_boxed_15_ = lean_unbox(v_negative_13_);
v_res_16_ = lp_vanillajs__q16__proof_Q16Formal_signedMagnitude(v_negative_boxed_15_, v_magnitude_14_);
return v_res_16_;
}
}
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_checkedSign(uint8_t v_negative_17_, lean_object* v_magnitude_18_){
_start:
{
lean_object* v___x_19_; uint8_t v___x_20_; 
v___x_19_ = lp_vanillajs__q16__proof_Q16Formal_magnitudeLimit(v_negative_17_);
v___x_20_ = lean_nat_dec_le(v_magnitude_18_, v___x_19_);
lean_dec(v___x_19_);
if (v___x_20_ == 0)
{
lean_object* v___x_21_; 
lean_dec(v_magnitude_18_);
v___x_21_ = lean_box(0);
return v___x_21_;
}
else
{
lean_object* v___x_22_; lean_object* v___x_23_; 
v___x_22_ = lp_vanillajs__q16__proof_Q16Formal_signedMagnitude(v_negative_17_, v_magnitude_18_);
v___x_23_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_23_, 0, v___x_22_);
return v___x_23_;
}
}
}
LEAN_EXPORT lean_object* lp_vanillajs__q16__proof_Q16Formal_checkedSign___boxed(lean_object* v_negative_24_, lean_object* v_magnitude_25_){
_start:
{
uint8_t v_negative_boxed_26_; lean_object* v_res_27_; 
v_negative_boxed_26_ = lean_unbox(v_negative_24_);
v_res_27_ = lp_vanillajs__q16__proof_Q16Formal_checkedSign(v_negative_boxed_26_, v_magnitude_25_);
return v_res_27_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Lean(uint8_t builtin);
void lean_initialize();
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_vanillajs__q16__proof_Q16Formal(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
lean_initialize();
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Lean(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
lp_vanillajs__q16__proof_Q16Formal_radix = _init_lp_vanillajs__q16__proof_Q16Formal_radix();
lean_mark_persistent(lp_vanillajs__q16__proof_Q16Formal_radix);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
