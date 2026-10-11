"""Guard source integrity and deferred-boundary verdicts in CP-1c."""
import json
import os
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
from cp1c_suite22 import assess_output, boundary_instrument, read_source
from f02_rules import paired
from cp1c_mapping import mapping
from cp1c_sources import prepare as revised, REVISED, UNUSED
from f02_source_audit import prepare
from cp1c_reconciliation import identity_field_proof


class Suite22Tests(unittest.TestCase):
    def trace(self, **changes):
        value={'role':'authenticated','subject':'c2310000-0000-4000-8000-000000000001','actualSession':True}
        value.update(changes)
        return 'CP1C_BOUNDARY:'+json.dumps(value)+'\n'

    def test_git_source_does_not_pass_through_log_redaction(self):
        source='set local "request.jwt.claims"=\'{"sub":"fixture","role":"authenticated"}\';'
        with patch('cp1c_suite22.subprocess.run',return_value=subprocess.CompletedProcess([],0,source,'')) as call:
            self.assertEqual(read_source('fixture-sha'),source)
            self.assertEqual(call.call_args.args[0][0:2],['git','show'])
        with patch('cp1c_suite22.subprocess.run',return_value=subprocess.CompletedProcess([],1,'','')):
            with self.assertRaises(RuntimeError):read_source('missing')

    def test_initial_and_final_native_flush_are_instrumented_without_role_change(self):
        original='set constraints all immediate;\nreset role;'
        reinforced='set constraints all immediate;\nset constraints all deferred;\nreset role;\nset constraints all immediate;'
        self.assertEqual(boundary_instrument(original).count('CP1C_BOUNDARY:'),1)
        self.assertEqual(boundary_instrument(reinforced).count('CP1C_BOUNDARY:'),2)
        self.assertEqual(boundary_instrument(reinforced).count('reset role;'),1)

    def test_missing_or_wrong_positive_never_passes(self):
        good=self.trace()
        self.assertEqual(assess_output(good+'ok 1 - native positive\n',0)[0],'PASS')
        for output in ('',self.trace(role='postgres'),self.trace(subject='foreign'),self.trace(actualSession=False),good+self.trace(role='postgres')):
            self.assertEqual(assess_output(output,0)[0],'BLOQUEADO')

    def test_boundary_trace_does_not_mask_tap_or_constraint_failure(self):
        good=self.trace()
        self.assertEqual(assess_output(good+' not ok 2 - native negative\n',0)[0],'FAIL')
        self.assertEqual(assess_output(good+'Bail out! missing control\n',0)[0],'FAIL')
        self.assertEqual(assess_output(good,3)[0],'FAIL')

    def test_uml08_unknown_is_a_valid_xor_control_when_measured_explicitly(self):
        row={'probe':'CP1C UML08 35 UNKNOWN vs no source','status':'PASS',
             'observed':{'positive':{'accepted':True,'role':'authenticated','actualSession':True,'value':{'status':'unknown'}},
                         'negative':{'accepted':False,'role':'authenticated','actualSession':True}},
             'countsBefore':{'business':0},'countsAfter':{'business':0},'rollbackDelta':0}
        self.assertEqual(paired(row),'PASS')
        row['observed']['positive']['accepted']=False
        self.assertEqual(paired(row),'BLOQUEADO')

    def test_every_inventory_method_has_runtime_target_and_own_frontier(self):
        original=json.loads(Path(__file__).with_name('f02_descriptors.json').read_text(encoding='utf-8'))
        with patch.dict(os.environ,{'HAC44_CP1C':'0'}):config=mapping(revised(prepare(original)))
        self.assertEqual({d['id'] for d in original['methods']},{d['id'] for d in config['methods']})
        for descriptor in config['methods']:
            self.assertTrue(descriptor['runtimeChain'],descriptor['id'])
            for key in ('nativeSymbol','controlPositive','frontier','mappingLimit'):
                self.assertTrue(descriptor[key],descriptor['id']+' '+key)
            self.assertNotIn('estado',descriptor)
            if descriptor['id'] in UNUSED:
                self.assertTrue(descriptor['partialUntilRuntimeMeasured'])
                self.assertEqual(descriptor['requiredProbes'],['RUNTIME_METHOD '+descriptor['id']])
        for number,key in REVISED.items():
            relation=next(d for d in config['rows'] if d['tipo']=='relacion' and d['id'].split()[0]==key)
            self.assertEqual(relation['requiredProbes'],['CP1C UML08 relation '+str(number)+' both ends'])
            self.assertEqual(len(relation['coverageObligations']),2)
        cargo=next(d for d in config['methods'] if d['id']=='CargoSpecification.validate')
        self.assertEqual(cargo['nativeSymbol'],'CargoSpecificationV2Schema')
        self.assertTrue(any('/application/draft-service.ts:' in r.get('citation','') for r in cargo['runtimeChain']))

    def test_identity_dictionary_reconciliation_requires_both_kinds_of_link(self):
        history={'status':'PASS','legacy':[{'provider':None}]}
        linked={'provider':'OTHER'}
        rounds=[{'kind':'links','status':'PASS','written':linked.copy(),'read':linked.copy()}]
        result={'status':'PASS','actualAuthSessions':True,'actualPKCE':True,'cases':[
            {'case':name,'status':'PASS','http':code} for name,code in
            [('historical links read',200),('verified PKCE consent',201),
             ('ordinary bearer cannot forge client consent',403),('foreign revocation denied',404)]]}
        self.assertTrue(identity_field_proof('provider',history,rounds,result))
        self.assertFalse(identity_field_proof('provider',{},rounds,result))
        self.assertFalse(identity_field_proof('provider',{'status':'PASS','legacy':[{}]},rounds,result))
        rounds[0]['written']['provider']=''
        self.assertFalse(identity_field_proof('provider',history,rounds,result))
        rounds[0]['written']['provider']=None
        self.assertFalse(identity_field_proof('provider',history,rounds,result))
        rounds[0]['written']=linked.copy();result['actualPKCE']=False
        self.assertFalse(identity_field_proof('provider',history,rounds,result))

    def test_http_ranking_option_is_not_a_database_attempt_record(self):
        row={'probe':'CP1C UML08 relation 40 both ends','status':'PASS',
             'observed':{'positiveHttp':201,'positiveOption':{'offerIds':['native-offer']}},
             'controlPositive':'Native paired disjoint and overlapping offers'}
        self.assertEqual(paired(row),'PASS')
        row['observed']['positiveHttp']=400
        self.assertEqual(paired(row),'BLOQUEADO')


if __name__=='__main__':unittest.main()
