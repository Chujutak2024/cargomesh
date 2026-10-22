import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpokenQuantities} from './spoken-quantities';
test('bounded spoken quantities accept actual Nova transcript and Spanish equivalents',()=>{
 for(const [spoken,expected] of [['twelve pallets','12 pallets'],['Each pallet weighs one hundred kilograms.','Each pallet weighs 100 kilograms.'],['one thousand two hundred kilograms','1200 kilograms'],['doce pallets de arroz','12 pallets de arroz'],['ciento veinte kilogramos','120 kilogramos'],['mil doscientos kilogramos','1200 kilogramos'],['veintidós cajas','22 cajas'],['twenty-five boxes','25 boxes'],['Treinta y dos','32']])assert.equal(normalizeSpokenQuantities(spoken),expected);
});
test('normalization does not rewrite names, contacts, digit sequences, negatives or unsupported grammar',()=>{
 for(const value of ['Sede Tres Cruces','Twenty Twenty logistics','one one kilograms','nine six zero','menos dos metros','minus one meter','one million kilograms','Ana Dos','one@company.test'])assert.equal(normalizeSpokenQuantities(value),value);
});
