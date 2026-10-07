"""Current-contract mapping and conservative evidence promotions, without a DB."""
import ast
import unittest
from pathlib import Path
from matrix_rules import attribute_state, relationship_state, native_control, fixed_row_verdicts

SOURCE = Path(__file__).with_name("matrix.py").read_text(encoding="utf-8")


def mappings():
    names = {"ALIASES","OVERRIDE","GROUPS","WFSPECIAL","CATKINDS","WFKINDS","CAT_OUTPUT_KEYS"}
    functions = {"node","workflow_output","schema_paths","storage","output_key"}
    tree = ast.parse(SOURCE)
    subset = [x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in functions
        or isinstance(x,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in x.targets)]
    context = {"READ_PROJECTIONS":{},"TREES":{},"COL":{},"CLASS":{}}
    exec(compile(ast.Module(body=subset,type_ignores=[]),"matrix-mappings","exec"),context)
    return context


def obj(**fields):
    return {"type":"ZodObject","fields":fields}


FIELD = {"type":"ZodString","nullable":False,"optional":False}
EV = [{"state":"VALUE","value":"concrete"}]


class AttributeRulesTests(unittest.TestCase):
    def positive(self):
        self.assertEqual(attribute_state(True,"column",False,FIELD,EV)[0],"COMPLETO")

    def test_missing_storage_remains_missing_despite_http_value(self):
        self.positive(); self.assertEqual(attribute_state(False,"column",False,FIELD,EV)[0],"FALTANTE")

    def test_required_optional_or_nullable_output_is_divergent(self):
        self.positive()
        for flag in ["optional","nullable"]:
            self.assertEqual(attribute_state(True,"json",False,{**FIELD,flag:True},EV)[0],"DIVERGENTE")

    def test_absent_value_never_automatically_promotes(self):
        self.positive(); self.assertEqual(attribute_state(True,"column",False,FIELD,[])[0],"PARCIAL")

    def test_missing_json_field_and_external_projection_are_conservative(self):
        self.positive()
        self.assertEqual(attribute_state(True,"json",False,None,EV)[0],"FALTANTE")
        self.assertEqual(attribute_state(False,"external_projection",False,None,[])[0],"PARCIAL")

    def test_reservation_uses_direct_resource_dto_and_column(self):
        m=mappings(); m["TREES"]={"workflow.ts:WorkflowRecordV2Schema":{"options":[obj(kind={"value":"holds"},data=obj(planResourceId=FIELD,assignmentId=FIELD))]}}
        m["CLASS"]={"CapacityReservation":{"storage":"capacity_reservations","attributes":[{"name":"planResourceId","target":"capacity_reservations.plan_assignment_id"}]}}
        m["COL"]={("capacity_reservations","plan_resource_id"):FIELD}
        _,output,_,path,_=m["schema_paths"]("CapacityReservation","planResourceId")
        self.assertEqual(path,"data.planResourceId"); self.assertEqual(output,FIELD)
        self.assertEqual(m["storage"]("CapacityReservation","planResourceId",path)[0],["capacity_reservations.plan_resource_id"])
        m["TREES"]["workflow.ts:WorkflowRecordV2Schema"]["options"][0]["fields"]["data"]["fields"].pop("planResourceId")
        self.assertIsNone(m["schema_paths"]("CapacityReservation","planResourceId")[1])

    def test_category_domain_version_does_not_select_integer_envelope(self):
        m=mappings();m["TREES"]={"catalog.ts:CatalogInputsV2:cargo-categories":obj(code=FIELD),
            "catalog.ts:CargoCategoryValueV2Schema":obj(code=FIELD,version=FIELD),
            "catalog.ts:CatalogRecordV2Schema":obj(version={**FIELD,"type":"ZodNumber"})}
        _,out,_,path,_=m["schema_paths"]("CargoCategory","version")
        self.assertEqual((out["type"],path),("ZodString","value.version"))
        self.assertEqual(attribute_state(True,"column",False,out,EV,uml_type="string")[0],"COMPLETO")
        m["TREES"]["catalog.ts:CargoCategoryValueV2Schema"]["fields"].pop("version")
        _,out,_,path,_=m["schema_paths"]("CargoCategory","version")
        self.assertEqual((out["type"],path),("ZodNumber","version"))
        self.assertEqual(attribute_state(True,"column",False,out,EV,uml_type="string")[0],"DIVERGENTE")

    def test_pool_partner_resolves_fulfilment_enum_not_nullable_partner_id(self):
        m=mappings();m["TREES"]={"catalog.ts:CatalogInputsV2:capacity-pools":obj(provenance={**FIELD,"type":"ZodEnum"},partnerId={**FIELD,"nullable":True})}
        _,out,_,path,_=m["schema_paths"]("CapacityPool","partner")
        self.assertEqual((path,out["nullable"]),("value.provenance",False))
        self.positive();self.assertEqual(attribute_state(True,"column",False,{**FIELD,"nullable":True},EV)[0],"DIVERGENTE")

    def test_normalized_read_node_requires_a_measured_projection(self):
        m=mappings();raw={"type":"ZodArray","optional":True,"nullable":False}
        m["TREES"]={"freight-request.ts:CreateFreightRequestV2InputSchema":obj(cargoSpecification=obj(availableDocuments=raw)),
            "freight-request.ts:FreightRequestV2ResponseSchema":obj(data=obj(cargoSpecification=obj(availableDocuments=raw)))}
        key=("freight-request.ts:FreightRequestV2ResponseSchema","data.cargoSpecification.availableDocuments")
        m["READ_PROJECTIONS"][key]={"outputNode":{**raw,"optional":False},"file":"measured.json"}
        out=m["schema_paths"]("CargoSpecification","availableDocuments")[1]
        self.assertEqual(attribute_state(True,"json",False,out,EV)[0],"COMPLETO")
        m["READ_PROJECTIONS"].clear();out=m["schema_paths"]("CargoSpecification","availableDocuments")[1]
        self.assertEqual(attribute_state(True,"json",False,out,EV)[0],"DIVERGENTE")


class RelationshipRulesTests(unittest.TestCase):
    def fixtures(self):
        cons=[{"definition":"FOREIGN KEY (parent_id) REFERENCES parents(id)"}]
        fk=[{"status":"PASS"}]
        proof={"status":"PASS","physicalVerified":True}
        self.assertEqual(relationship_state("child.parent_id",["1","1..*"],cons,fk,proof)[0],"COMPLETO")
        return cons,fk,proof

    def test_minimum_and_bijection_need_dedicated_semantic_proof(self):
        c,f,p=self.fixtures()
        for labels in [["1","1..*"],["1","1"]]:
            self.assertEqual(relationship_state("child.parent_id",labels,c,f)[0],"PARCIAL")

    def test_failed_or_blocked_fk_never_promotes(self):
        c,f,p=self.fixtures()
        for state,expected in [("FAIL","DIVERGENTE"),("BLOQUEADO","PARCIAL")]:
            self.assertEqual(relationship_state("child.parent_id",["1","1..*"],c,[{"status":state}],p)[0],expected)

    def test_native_success_without_physical_contract_is_partial(self):
        c,f,p=self.fixtures();p["physicalVerified"]=False
        self.assertEqual(relationship_state("child.parent_id",["1","1..*"],c,f,p)[0],"PARCIAL")

    def test_real_missing_reference_remains_missing(self):
        c,f,p=self.fixtures();self.assertEqual(relationship_state("NO bridge",[],c,f,p,absent=True)[0],"FALTANTE")

    def test_composite_or_json_reference_is_not_certified_by_fk_alone(self):
        c,f,p=self.fixtures();self.assertEqual(relationship_state("parent.data.ids[] JSON",["1","0..*"],c,f)[0],"PARCIAL")

    def test_native_control_requires_executed_same_cut_positive_and_negative(self):
        source="select pass('positive'); select throws_ok('negative');"
        log="32_v2_hac40_uml_cardinalities.test.sql ........ ok\nResult: PASS\nEXIT_CODE: 0"
        self.assertEqual(native_control(source,log,["positive"],["negative"],True)["status"],"PASS")
        for src,output,same in [(source,"",True),(source,log,False),("select pass('positive');",log,True)]:
            self.assertEqual(native_control(src,output,["positive"],["negative"],same)["status"],"BLOQUEADO")

    def test_fixed_verdict_by_row_name_or_number_is_rejected(self):
        self.assertEqual(fixed_row_verdicts(SOURCE),[])
        self.assertEqual(fixed_row_verdicts(Path(__file__).with_name("matrix_rules.py").read_text()),[])
        bad=["def attributes():\n if name == 'CapacityPool' and attr == 'partner':\n  status = 'DIVERGENTE'\n",
             "def relationships():\n if n in (28,70,90):\n  status = 'DIVERGENTE'\n",
             "def attributes():\n status = {'CapacityPool':'COMPLETO'}[name]\n"]
        for code in bad:self.assertTrue(fixed_row_verdicts(code))


if __name__ == "__main__":
    unittest.main()
