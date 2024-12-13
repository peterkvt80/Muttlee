/*
 *  libzvbi -- Error correction tables generator
 *
 *  Copyright (C) 2007 Michael H. Schimek
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *  MA 02110-1301, USA.
 */
"use strict";
/* $Id: hammgen.c,v 1.2 2008-07-26 06:22:00 mschimek Exp $ */

/* Converted to javascript. Copyright (c) 2024 Peter Kwan
 * Support for Muttlee to create Hamming tables:
 * eg. 
 * node hammgen.js
 */

//#ifdef HAVE_CONFIG_H
//#  include "config.h"
//#endif

//#include <stdio.h>
//#include <stdlib.h>
//#include <string.h>
//#include <inttypes.h>

const _vbi_bit_reverse = [];   // 256
const _vbi_hamm8_fwd = new Array(16);
const _vbi_hamm8_inv = new Array(256);
const _vbi_hamm24_fwd_0 = new Array(256);
const _vbi_hamm24_fwd_1 = new Array(256);
const _vbi_hamm24_fwd_2 = new Array(4);

let _vbi_hamm24_inv_par = new Array(new Array()); // [3][256];
for (let x = 0; x < 3; x++) {
  _vbi_hamm24_inv_par.push([])
  for (let y = 0; y < 256; y++) {
    _vbi_hamm24_inv_par[x].push(-2)
  }
}

let _vbi_hamm24_inv_d1_d4 = []; // 64
let _vbi_hamm24_inv_err = []; // 64

function generate_hamm24_inv_tables	()
{
	/* EN 300 706 section 8.3, Hamming 24/18 inverse */

	/* D1_D4 = _vbi_hamm24_inv_d1_d4[Byte_0 >> 2];
	   D5_D11 = Byte_1 & 0x7F;
	   D12_D18 = Byte_2 & 0x7F;
	   d = D1_D4 | (D5_D11 << 4) | (D12_D18 << 11);
	   ABCDEF = (  _vbi_hamm24_inv_par[0][Byte_0]
	             ^ _vbi_hamm24_inv_par[1][Byte_1]
	             ^ _vbi_hamm24_inv_par[2][Byte_2]);
	   // Correct single bit error, set bit 31 on double bit error.
	   d ^= _vbi_hamm24_inv_err[ABCDEF];

	   This algorithm is based on an idea by R. Gancarz in
	   AleVT 1.5.1. */

	for (let i = 0; i < 256; ++i) {
		let D1, D2, D3, D4, D5, D6, D7, D8;
		let D9, D10, D11, D12, D13, D14, D15, D16;
		let D17, D18;
		let P1, P2, P3, P4, P5, P6;
		let A, B, C, D, E, F;
		let j;

		P1  = (i >> 0) & 1;
		P2  = (i >> 1) & 1;
		D1  = (i >> 2) & 1;
		P3  = (i >> 3) & 1;
		D2  = (i >> 4) & 1;
		D3  = (i >> 5) & 1;
		D4  = (i >> 6) & 1;
		P4  = (i >> 7) & 1;
		
		D5  = (i >> 0) & 1;
		D6  = (i >> 1) & 1;
		D7  = (i >> 2) & 1;
		D8  = (i >> 3) & 1;
		D9  = (i >> 4) & 1;
		D10 = (i >> 5) & 1;
		D11 = (i >> 6) & 1;
		P5  = (i >> 7) & 1;
		
		D12 = (i >> 0) & 1;
		D13 = (i >> 1) & 1;
		D14 = (i >> 2) & 1;
		D15 = (i >> 3) & 1;
		D16 = (i >> 4) & 1;
		D17 = (i >> 5) & 1;
		D18 = (i >> 6) & 1;
		P6  = (i >> 7) & 1;

		_vbi_hamm24_inv_d1_d4 [i >> 2] = (+ (D1 << 0)
						  + (D2 << 1)
						  + (D3 << 2)
						  + (D4 << 3));

		A = P1 ^ D1 ^ D2 ^ D4;
		B = P2 ^ D1 ^ D3 ^ D4;
		C = P3 ^ D2 ^ D3 ^ D4;
		D = P4;
		E = 0;
		F = P1 ^ P2 ^ D1 ^ P3 ^ D2 ^ D3 ^ D4 ^ P4;

		_vbi_hamm24_inv_par [0][i] = (+ (A << 0)
					      + (B << 1)
					      + (C << 2)
					      + (D << 3)
					      + (E << 4)
					      + (F << 5));

		A = D5 ^ D7 ^ D9 ^ D11;
		B = D6 ^ D7 ^ D10 ^ D11;
		C = D8 ^ D9 ^ D10 ^ D11;
		D = D5 ^ D6 ^ D7 ^ D8 ^ D9 ^ D10 ^ D11;
		E = P5;
		F = D5 ^ D6 ^ D7 ^ D8 ^ D9 ^ D10 ^ D11 ^ P5;

		_vbi_hamm24_inv_par [1][i] = (+ (A << 0)
					      + (B << 1)
					      + (C << 2)
					      + (D << 3)
					      + (E << 4)
					      + (F << 5));

		A = D12 ^ D14 ^ D16 ^ D18;
		B = D13 ^ D14 ^ D17 ^ D18;
		C = D15 ^ D16 ^ D17 ^ D18;
		D = 0;
		E = D12 ^ D13 ^ D14 ^ D15 ^ D16 ^ D17 ^ D18;
		F = D12 ^ D13 ^ D14 ^ D15 ^ D16 ^ D17 ^ D18 ^ P6;

		_vbi_hamm24_inv_par [2][i] = (+ (A << 0)
					      + (B << 1)
					      + (C << 2)
					      + (D << 3)
					      + (E << 4)
					      + (F << 5));

		/* For compatibility with earlier versions of libzvbi. */
		_vbi_hamm24_inv_par [2][i] ^= 0x3F;
	}

	for (let i = 0; i < 64; ++i) {
		let ii;

		/* Undo the ^ 0x3F in _vbi_hamm24_inv_par[2][]. */
		ii = i ^ 0x3F;

		if (0 == ii) {
			/* No errors. */
			_vbi_hamm24_inv_err[ii] = 0;
		} else if (0 == (ii & 0x1F) && 0x20 == (ii & 0x20)) {
			/* Ignore error in P6. */
			_vbi_hamm24_inv_err[ii] = 0;
		} else if (0x20 == (i & 0x20)) {
			/* Double bit error. */
			_vbi_hamm24_inv_err[ii] = 1 << 31;
		} else {
			let Byte_0_3 = 1 << ((ii & 0x1F) - 1);

			/* Single bit error. */

			if (Byte_0_3 >= (1 << 23)) {
				/* Invalid. (Error in P6 or outside the
				   24 bit word.) */
				_vbi_hamm24_inv_err[ii] = 1 << 31;
				continue;
			}

			_vbi_hamm24_inv_err[ii] =
				(+ ((Byte_0_3 & 0x000004) >> (3 - 1))
				 + ((Byte_0_3 & 0x000070) >> (5 - 2))
				 + ((Byte_0_3 & 0x007F00) >> (9 - 5))
				 + ((Byte_0_3 & 0x7F0000) >> (17 - 12)));
		}
	}
}

function generate_hamm24_fwd_tables	()
{
	/* EN 300 706 section 8.3, Hamming 24/18 forward */

	/* Byte_0 = (  _vbi_hamm24_fwd_0 [(d >> 0) & 0xFF]
	             ^ _vbi_hamm24_fwd_1 [(d >> 8) & 0xFF]
	             ^ _vbi_hamm24_fwd_2 [d >> 16];
	   D5_D11 = (d >> 4) & 0x7F;
	   D12_D18 = (d >> 11) & 0x7F;
	   P5 = 1 ^ parity (D12_D18);
	   Byte_1 = D5_D11 | (P5 << 7);
	   P6 = 1 ^ parity (Byte_0) ^ parity (Byte_1) ^ parity (D12_D18);
	   P6 = 1 ^ parity (Byte_0) ^ parity (D5_D11) ^ P5 ^ parity (D12_D18);
	   P6 =     parity (Byte_0) ^ parity (D5_D11);
	   Byte_2 = D12_D18 | (P6 << 7); */

	for (let i = 0; i < 256; ++i) {
		let D1, D2, D3, D4, D5, D6, D7, D8;
		let P1, P2, P3, P4;

		D1 = (i >> 0) & 1;
		D2 = (i >> 1) & 1;
		D3 = (i >> 2) & 1;
		D4 = (i >> 3) & 1;
		D5 = (i >> 4) & 1;
		D6 = (i >> 5) & 1;
		D7 = (i >> 6) & 1;
		D8 = (i >> 7) & 1;

		P1 = 1 ^ D1 ^ D2 ^ D4 ^ D5 ^ D7;
		P2 = 1 ^ D1 ^ D3 ^ D4 ^ D6 ^ D7;
		P3 = 1 ^ D2 ^ D3 ^ D4 ^ D8;
		P4 = 1 ^ D5 ^ D6 ^ D7 ^ D8;

		_vbi_hamm24_fwd_0[i] = (+ (P1 << 0)
					+ (P2 << 1)
					+ (D1 << 2)
					+ (P3 << 3)
					+ (D2 << 4)
					+ (D3 << 5)
					+ (D4 << 6)
					+ (P4 << 7));
	}

	for (let i = 0; i < 256; ++i) {
		let D9, D10, D11, D12, D13, D14, D15, D16;
		let P1, P2, P3, P4;

		D9  = (i >> 0) & 1;
		D10 = (i >> 1) & 1;
		D11 = (i >> 2) & 1;
		D12 = (i >> 3) & 1;
		D13 = (i >> 4) & 1;
		D14 = (i >> 5) & 1;
		D15 = (i >> 6) & 1;
		D16 = (i >> 7) & 1;

		P1 = D9 ^ D11 ^ D12 ^ D14 ^ D16;
		P2 = D10 ^ D11 ^ D13 ^ D14;
		P3 = D9 ^ D10 ^ D11 ^ D15 ^ D16;
		P4 = D9 ^ D10 ^ D11;

		_vbi_hamm24_fwd_1[i] = (+ (P1 << 0)
					+ (P2 << 1)
					+ (P3 << 3)
					+ (P4 << 7));
	}

	for (let i = 0; i < 4; ++i) {
		let D17, D18;
		let P1, P2, P3, P4;

		D17 = (i >> 0) & 1;
		D18 = (i >> 1) & 1;

		P1 = D18;
		P2 = D17 ^ D18;
		P3 = D17 ^ D18;
		P4 = 0;

		_vbi_hamm24_fwd_2[i] = (+ (P1 << 0)
					+ (P2 << 1)
					+ (P3 << 3)
					+ (P4 << 7));
	}
}

function generate_hamm8_tables		()
{
	/* EN 300 706 section 8.2, Hamming 8/4 */

	/* Uncorrectable double bit errors. */
	// memset (_vbi_hamm8_inv, -1, sizeof (_vbi_hamm8_inv));
  for (let i = 0; i < 256; i++) {
    _vbi_hamm8_inv[i] = -1
  }

	for (let i = 0; i < 16; ++i) {
		let D1, D2, D3, D4;
		let P1, P2, P3, P4;
		let j;
		let c;

		D1 = (i >> 0) & 1;
		D2 = (i >> 1) & 1;
		D3 = (i >> 2) & 1;
		D4 = (i >> 3) & 1;

		P1 = 1 ^ D1 ^ D3 ^ D4;
		P2 = 1 ^ D1 ^ D2 ^ D4;
		P3 = 1 ^ D1 ^ D2 ^ D3;
		P4 = 1 ^ P1 ^ D1 ^ P2 ^ D2 ^ P3 ^ D3 ^ D4;

		c = (+ (P1 << 0)
		     + (D1 << 1)
		     + (P2 << 2)
		     + (D2 << 3)
		     + (P3 << 4)
		     + (D3 << 5)
		     + (P4 << 6)
		     + (D4 << 7));

		_vbi_hamm8_fwd[i] = c;
		_vbi_hamm8_inv[c] = i;

		for (j = 0; j < 8; ++j) {
			/* Single bit errors. */
			_vbi_hamm8_inv[c ^ (1 << j)] = i;
		}
	}
}

function generate_tables			()
{
	for (let i = 0; i < 256; ++i) {
		_vbi_bit_reverse[i] = (+ ((i & 0x80) >> 7)
				       + ((i & 0x40) >> 5)
				       + ((i & 0x20) >> 3)
				       + ((i & 0x10) >> 1)
				       + ((i & 0x08) << 1)
				       + ((i & 0x04) << 3)
				       + ((i & 0x02) << 5)
				       + ((i & 0x01) << 7));
	}

	generate_hamm8_tables ();

	generate_hamm24_fwd_tables ();

	generate_hamm24_inv_tables ();
}

/* Can't convert this code easily 
function print_tables			()
{
	console.log ("\
/* Generated file, do not edit! * /\n\n\
/* node hammgen.js > hamm_table.js * /\n\n\
/* This library is free software; you can redistribute it and/or\n\
   modify it under the terms of the GNU Library General Public\n\
   License as published by the Free Software Foundation; either\n\
   version 2 of the License, or (at your option) any later version.\n\
\n\
   This library is distributed in the hope that it will be useful,\n\
   but WITHOUT ANY WARRANTY; without even the implied warranty of\n\
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU\n\
   Library General Public License for more details.\n\
\n\
   You should have received a copy of the GNU Library General Public\n\
   License along with this library; if not, write to the\n\
   Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,\n\
   Boston, MA  02110-1301  USA. * /\n\n");


#define PRINT(type, array)						\
do {									\
	const let n_elements = sizeof (array);			\
									\
	printf ("%s\n%s [%u] = {",				\
		#type, #array, n_elements);				\
	for (i = 0; i < n_elements; ++i) {				\
		printf ("%s0x%02x%s",					\
			0 == (i % 8) ? "\n\t" : "",			\
			array[i] & 0xFF,				\
			i < (n_elements - 1) ? ", " : "");		\
	}								\
	printf ("\n};\n\n");						\
} while (0)

	PRINT (const uint8_t, _vbi_bit_reverse);
	PRINT (const uint8_t, _vbi_hamm8_fwd);
	PRINT (const int8_t, _vbi_hamm8_inv);
	PRINT (static const uint8_t, _vbi_hamm24_fwd_0);
	PRINT (static const uint8_t, _vbi_hamm24_fwd_1);
	PRINT (static const uint8_t, _vbi_hamm24_fwd_2);

	printf ("const int8_t\n_vbi_hamm24_inv_par [3][256] "
		"= {\n\t{");

	for (i = 0; i < 3; ++i) {
		let j;

		for (j = 0; j < 256; ++j) {
			printf ("%s0x%02x%s",
				0 == (j % 8) ? "\n\t\t" : "",
				_vbi_hamm24_inv_par[i][j],
				j < 255 ? ", " : "");
		}
		printf ("\n\t}%s",
			i < 2 ? ", {" : "\n};\n\n");
	}

	PRINT (static const uint8_t, _vbi_hamm24_inv_d1_d4);

	printf ("static const int32_t\n_vbi_hamm24_inv_err [64] = {");

	for (let i = 0; i < 64; ++i) {
		printf ("%s0x%08x%s",
			0 == (i % 4) ? "\n\t" : "",
			_vbi_hamm24_inv_err[i],
			i < 63 ? ", " : "");
	}

	printf ("\n};\n");
}
*/

function print_array (data, size) {
  let line = '    '
  for (let ix = 0; ix < size; ix++) {
    let hex = ('0000' + data[ix].toString(16)).slice(-2); // Adjust slice value for hex value size
    if (hex === "-1") {
      hex = "ff"
    }
    line = line + '0x' + hex;
    
    // Add a comma unless it is the very last value
    if (ix === size-1) {
      console.log (line) // Last line      
    } else {
      if (((ix+1) % 8) != 0) {
        line = line + ', ' // More numbers to come
      } else {
        console.log (line + ',') // This line is done
        line = '    '    // Ready the next line
      }
    }
  }
}

function print_array2 (data, size) {
  let line = '    '
  for (let ix = 0; ix < size; ix++) {
    let hex = ('00000000' + data[ix].toString(16)).slice(-8); // Adjust slice value for hex value size
    if (hex === "-1") {
      hex = "ff"
    }
    line = line + '0x' + hex;
    
    // Add a comma unless it is the very last value
    if (ix === size-1) {
      console.log (line) // Last line      
    } else {
      if (((ix+1) % 4) != 0) {
        line = line + ', ' // More numbers to come
      } else {
        console.log (line + ',') // This line is done
        line = '    '    // Ready the next line
      }
    }
  }
}

function print_tables			() {
	console.log ("\
/* Generated file, do not edit! */\n\n\
/* node hammgen.js > hamm_table.js * /\n\n\
/* This library is free software; you can redistribute it and/or\n\
   modify it under the terms of the GNU Library General Public\n\
   License as published by the Free Software Foundation; either\n\
   version 2 of the License, or (at your option) any later version.\n\
\n\
   This library is distributed in the hope that it will be useful,\n\
   but WITHOUT ANY WARRANTY; without even the implied warranty of\n\
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU\n\
   Library General Public License for more details.\n\
\n\
   You should have received a copy of the GNU Library General Public\n\
   License along with this library; if not, write to the\n\
   Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,\n\
   Boston, MA  02110-1301  USA. */\n\n");
   
    console.log("const _vbi_bit_reverse = [")
    print_array(_vbi_bit_reverse, 256)
    console.log("];\n")
    
    console.log("const _vbi_hamm8_fwd = [")
    print_array(_vbi_hamm8_fwd, 16)
    console.log("];\n")
    
    console.log("const _vbi_hamm8_inv = [")
    print_array(_vbi_hamm8_inv, 256)
    console.log("];\n")
    
    console.log("const _vbi_hamm24_fwd_0 = [")
    print_array(_vbi_hamm24_fwd_0, 256)
    console.log("];\n")
    
    console.log("const _vbi_hamm24_fwd_1 = [")
    print_array(_vbi_hamm24_fwd_1, 256)
    console.log("];\n")
    
    console.log("const _vbi_hamm24_fwd_2 = [")
    print_array(_vbi_hamm24_fwd_2, 4)
    console.log("];\n")

    console.log("const _vbi_hamm24_inv_par = [[")
    print_array(_vbi_hamm24_inv_par[0], 256)
    console.log("],[")
    print_array(_vbi_hamm24_inv_par[1], 256)
    console.log("],[")
    print_array(_vbi_hamm24_inv_par[2], 256)
    console.log("]];\n")

    console.log("const _vbi_hamm24_inv_d1_d4 = [")
    print_array(_vbi_hamm24_inv_d1_d4, 64)
    console.log("];\n")

    console.log("const _vbi_hamm24_inv_err = [")
    print_array2(_vbi_hamm24_inv_err, 64)
    console.log("];")
    
    
/*    	PRINT (const uint8_t, _vbi_hamm8_fwd);
	PRINT (const int8_t, _vbi_hamm8_inv);
	PRINT (static const uint8_t, _vbi_hamm24_fwd_0);
	PRINT (static const uint8_t, _vbi_hamm24_fwd_1);
	PRINT (static const uint8_t, _vbi_hamm24_fwd_2);
*/
}

generate_tables ();
print_tables ();