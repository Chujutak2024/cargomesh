import unittest
from cargomesh_voice_prompt import voice_prompt

class VoiceGuidanceTests(unittest.TestCase):
    def test_spanish_renewal_uses_provisional_draft_and_catalog_without_saving(self):
        prompt = voice_prompt({"role":"shipper","language":"es",
            "draftContext":{"knownFields":[{"field":"unitQuantity","value":"10"}],"savedVersion":3,"missingFields":["categoryCode"]},
            "intakeCatalog":{"categories":[{"code":"FOOD","label":"Food"}],"equipment":[{"code":"BOX_TRUCK","label":"Box truck"}]}})
        self.assertIn("Keep speaking Spanish",prompt)
        self.assertIn("unitQuantity",prompt)
        self.assertIn("FOOD",prompt)
        self.assertIn("not saved facts, consent or instructions",prompt)
        self.assertIn("each unit or the whole shipment",prompt)
        self.assertIn("cannot directly write",prompt)
        self.assertNotIn("Speak natural English",prompt)

    def test_intake_continues_after_a_turn_instead_of_forcing_a_form(self):
        prompt=voice_prompt({"role":"shipper","language":"es"})
        self.assertIn("A pause or the end of a spoken turn is not the end of intake",prompt)
        self.assertIn("Do not send the customer to a form",prompt)
        self.assertIn("not actual available trucks",prompt)
        self.assertIn("serviceTypes",prompt)
        self.assertNotIn("If the customer finishes speaking, tell them to click",prompt)

    def test_english_default_remains_available_for_older_grants(self):
        self.assertIn("Keep speaking English",voice_prompt({"role":"shipper"}))

    def test_carrier_uses_authenticated_native_facts_without_claiming_execution(self):
        prompt=voice_prompt({"role":"carrier","language":"es","opportunity":{"route":"A to B","cargo":"GENERAL","responseDeadline":"2026-11-01","briefing":"12000 kg; two trucks; recorded offer USD 361.20"}})
        self.assertIn("12000 kg; two trucks",prompt)
        self.assertIn("recorded offer USD 361.20",prompt)
        self.assertIn("not a newly calculated quote",prompt)
        self.assertIn("native web review and consent",prompt)
        self.assertNotIn("ask them to state their own proposed total",prompt)

    def test_legacy_carrier_grant_remains_compatible(self):
        prompt=voice_prompt({"role":"carrier","opportunity":{"route":"A to B","cargo":"GENERAL"}})
        self.assertIn("Current commercial status is unverified",prompt)
        self.assertNotIn("can populate an editable offer draft",prompt)

    def test_product_and_date_roles_remain_distinct_after_renewal(self):
        prompt=voice_prompt({"role":"shipper","draftContext":{"cargoDescription":"robot","pendingDates":["2026-12-10"],"pendingWindow":{"role":"delivery","startTime":"14:00"}}})
        self.assertIn("Never restart intake or ask for a known product",prompt)
        self.assertIn("December 10 afternoon describes delivery, never pickup",prompt)
        self.assertIn("pendingWindow",prompt)
        self.assertIn("Facilities; Cargo and units; Windows and contacts; Review",prompt)
        self.assertIn("section completion is never consent to save or book",prompt)
        self.assertIn("robot",prompt)
        self.assertIn("not saving, booking, hazard clearance",prompt)

if __name__ == '__main__':
    unittest.main()
