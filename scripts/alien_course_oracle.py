#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Independent stdlib Fraction oracle for the six static sample gates.
import json
from fractions import Fraction
ROWS = [
 ("01","0","3","-28","14","9"),("02","-3","3.5","-75","13","9"),
 ("03","4","4","-124","13","9"),("04","0","3","-175","12","8"),
 ("05","-4","3.5","-225","12","8"),("06","0","3","-285","14","9")
]
SCALE=65536
def raw(value):
    q=value*SCALE
    if q.denominator!=1 or not -(2**31)<=q.numerator<2**31:
        raise ValueError("not representable as signed Q16.16")
    return q.numerator
def gate(row):
    name,x,y,z,width,height=row
    x,y,z,width,height=map(Fraction,(x,y,z,width,height))
    return dict(id=name,leftRaw=raw(x-width/2),rightRaw=raw(x+width/2),
                bottomRaw=raw(y-height/2),topRaw=raw(y+height/2),zRaw=raw(z))
def crosses(g,from_,to):
    plane=Fraction(g["zRaw"],SCALE)
    if not from_[2]>plane>=to[2]: return False
    t=(from_[2]-plane)/(from_[2]-to[2])
    x=from_[0]+(to[0]-from_[0])*t
    y=from_[1]+(to[1]-from_[1])*t
    return Fraction(g["leftRaw"],SCALE)<=x<=Fraction(g["rightRaw"],SCALE) and \
      Fraction(g["bottomRaw"],SCALE)<=y<=Fraction(g["topRaw"],SCALE)
if __name__=="__main__":
    gates=[gate(r) for r in ROWS]
    a=(Fraction(0),Fraction(3),Fraction(0))
    b=(Fraction(0),Fraction(3),Fraction(-100))
    count=sum(crosses(g,a,b) for g in gates)
    print(json.dumps(dict(gates=gates,sweepFirstTwo=count),sort_keys=True))
