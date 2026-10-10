"""Paired controls for evidence loss, failed positives and semantic overclaiming."""
import unittest
from f02_rules import attribute_verdict, contract_verdict, class_verdict, paired, apply_directed_retests
from real_auth import replace_claims
from common import safe
from f02_source_audit import prepare
import json
from pathlib import Path


class F02Tests(unittest.TestCase):
    def test_directed_retry_is_scoped_and_failed_new_positive_stays_blocked(self):
        old={'probe':'DB_FIELD A NULL','rowIds':['A'],'status':'BLOQUEADO','source':'PROBES/CP2_RESULTADOS.json#1'}
        unrelated={**old,'rowIds':['B'],'source':'PROBES/CP2_RESULTADOS.json#2'}
        retry={**old,'status':'PASS','source':'PROBES/CP1B_AUDIT.json#1','observed':{'positive':{'accepted':False}},'supersedes':{'probe':old['probe'],'source':'PROBES/CP2_RESULTADOS.json','reason':'Correct emitted parent ID'}}
        current=apply_directed_retests([old,unrelated],[retry])
        self.assertIn(unrelated,current)
        self.assertEqual(current[-1]['supersededEvidence'],[{'source':old['source'],'status':'BLOQUEADO'}])
        self.assertEqual(paired(current[-1]),'BLOQUEADO')
        retry['supersedes']['probe']='other'
        with self.assertRaises(ValueError):apply_directed_retests([old],[retry])
    def test_source_audit_has_exact_ends_and_no_empty_method_recipe(self):
        config=prepare(json.loads(Path(__file__).with_name('f02_descriptors.json').read_text(encoding='utf-8')))
        for m in config['methods']:
            self.assertTrue(m['requiredProbes'])
            for source in m['fuentes_candidatas_verificadas']:self.assertGreater(int(source.rsplit(':',1)[1]),1)
            if m['mappingStatus'].endswith('PENDING'):
                self.assertIn(m['metodo_uml'],m['blockedCause'])
                self.assertTrue(m['owner'].startswith('HAC-44'))
        for r in config['rows']:
            if r['tipo']=='relacion':self.assertIn('labels',r['umlEnds']);self.assertTrue(r['umlCitation'])

    def test_failed_exported_native_positive_is_blocked(self):
        row={'probe':'NATIVE_METHOD CargoUnit.totalWeightKg','status':'PASS','controlPositive':'native call','observed':{'positiveNative':{'accepted':True}}}
        self.assertEqual(paired(row),'PASS')
        row['observed']['positiveNative']['accepted']=False
        self.assertEqual(paired(row),'BLOQUEADO')

    def positive(self):
        d={'id':'Thing.field','requiredProbes':['DB_FIELD Thing.field NULL'], 'nullableOutput':False}
        e=[{'probe':'FIELD_READ Thing.field','rowIds':['Thing.field'],'status':'PASS','observed':{'value':3}},
           {'probe':d['requiredProbes'][0],'rowIds':['Thing.field'],'status':'PASS',
            'observed':{'positive':{'accepted':True,'role':'authenticated','actualSession':True}},
            'countsBefore':{'public.things':1},'countsAfter':{'public.things':1},'rollbackDelta':0}]
        self.assertEqual(attribute_verdict(d,e)[0],'EVIDENCIA_MEDIDA')
        self.assertEqual(contract_verdict(d['requiredProbes'],e)[0],'EVIDENCIA_MEDIDA')
        return d,e

    def test_failed_positive_blocks_even_if_negative_passes(self):
        d,e=self.positive();e[1]['observed']['positive']['accepted']=False
        self.assertEqual(attribute_verdict(d,e)[0],'BLOQUEADO')

    def test_issuer_role_and_rollback_are_required(self):
        for change in ('role','claims','counts'):
            d,e=self.positive()
            if change=='role':e[1]['observed']['positive']['role']='postgres'
            elif change=='claims':e[1]['observed']['positive']['actualSession']=False
            else:e[1]['countsAfter']['public.things']=2
            self.assertEqual(attribute_verdict(d,e)[0],'BLOQUEADO')

    def test_missing_exact_control_and_related_class_are_not_pass(self):
        d,e=self.positive()
        self.assertEqual(attribute_verdict(d,e[:1])[0],'PARCIAL')
        e[1]['rowIds']=['Thing'];self.assertEqual(attribute_verdict(d,e)[0],'PARCIAL')
        self.assertEqual(contract_verdict(['other.method'],e)[0],'BLOQUEADO')

    def test_no_observable_and_unknown_null_remain_explicit(self):
        d,e=self.positive()
        self.assertEqual(attribute_verdict(d,[])[0],'BLOQUEADO')
        e[0]['observed']['value']=None;self.assertEqual(attribute_verdict(d,e)[0],'PARCIAL')
        d['nullableOutput']=True;self.assertEqual(attribute_verdict(d,e)[0],'PARCIAL')
        d['requiredProbes']=[];self.assertEqual(attribute_verdict(d,e)[0],'EVIDENCIA_MEDIDA')

    def test_class_requires_individual_methods(self):
        self.positive()
        self.assertEqual(class_verdict(['EVIDENCIA_MEDIDA'],['EVIDENCIA_MEDIDA'],['EVIDENCIA_MEDIDA'])[0],'EVIDENCIA_MEDIDA')
        self.assertEqual(class_verdict(['EVIDENCIA_MEDIDA'],[],['BLOQUEADO'])[0],'PARCIAL')

    def test_unknown_plan_does_not_control_a_capacity_xor(self):
        d,e=self.positive()
        row=e[1];row['probe']='XOR plan capacity source none'
        row['observed']['positive']['value']={'status':'eligible'}
        self.assertEqual(paired(row),'PASS')
        row['observed']['positive']['value']['status']='unknown'
        self.assertEqual(paired(row),'BLOQUEADO')

    def test_negative_must_reach_the_same_real_role(self):
        d,e=self.positive()
        row=e[1];row['observed']['negative']={'role':'authenticated','actualSession':True}
        self.assertEqual(paired(row),'PASS')
        row['observed']['negative']['role']='postgres'
        self.assertEqual(paired(row),'BLOQUEADO')

    def test_projection_uses_its_real_adapter_without_crud(self):
        d,e=self.positive();d.update(requiredProbes=[],representation='|capacity_projection.field',field={'dto_lectura':'NO_TYPED_OUTPUT'})
        e=[{'probe':'FIELD_READ Thing.field','rowIds':['Thing.field'],'status':'BLOQUEADO','observed':{'http':None}},
           {'probe':'PROJECTION Thing.field','rowIds':['Thing.field'],'status':'PASS','observed':{'value':'physical-source-id'},'controlPositive':'Own persisted native plan resource'}]
        self.assertEqual(attribute_verdict(d,e)[0],'EVIDENCIA_MEDIDA')
        self.assertEqual(attribute_verdict(d,e[:1])[0],'BLOQUEADO')
        e[1]['status']='BLOQUEADO';self.assertEqual(attribute_verdict(d,e)[0],'BLOQUEADO')

    def test_claims_replacement_and_redaction_have_positive_control(self):
        q='begin;set local role authenticated;set local "request.jwt.claims"=\'{"sub":"A","role":"authenticated"}\';reset role;commit;'
        good=lambda ids:{'A':{'sub':'A','role':'authenticated','session_id':'TEST_SESSION'}}
        result=replace_claims(q,good)
        self.assertIn('TEST_SESSION',result);self.assertIn('set constraints all immediate;\nreset role',result)
        self.assertNotIn('TEST_SESSION',safe(result))
        for claims in ({'sub':'B','role':'authenticated','session_id':'x'}, {'sub':'A','role':'postgres','session_id':'x'}, {'sub':'A','role':'authenticated'}):
            with self.assertRaises(RuntimeError):replace_claims(q,lambda ids:{'A':claims})


if __name__=='__main__':unittest.main()
