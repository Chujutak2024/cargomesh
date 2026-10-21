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

    def test_english_default_remains_available_for_older_grants(self):
        self.assertIn("Keep speaking English",voice_prompt({"role":"shipper"}))

if __name__ == '__main__':
    unittest.main()
