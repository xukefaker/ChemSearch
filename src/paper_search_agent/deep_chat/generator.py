from __future__ import annotations

from ..models import PaperRecord
from .models import FactExtractionBatch, GeneratedAnswer, HypothesisEvidencePack, InterpretationPlan


class DeepChatAnswerGenerator:
    def build_system_prompt(self) -> str:
        return (
            "You answer multi-turn questions about a single indexed scientific paper by comparing competing interpretations. "
            "Use only the supplied metadata, dialogue history, dialogue state, interpretation hypotheses, hypothesis fact sets, and hypothesis evidence packs. "
            "Return strict JSON only. "
            "decision must be one of: ask_clarification, answer, unsupported. "
            "If decision is answer, winning_hypothesis_id must identify the best-supported hypothesis and used_evidence_ids must be a non-empty list containing only ids from the supplied evidence packs. "
            "Base your answer on the extracted fact sets first; use raw evidence only to preserve provenance or resolve ties. "
            "Use competition signals plus discriminative/conflicting evidence to prefer the interpretation that is best separated from its alternatives. "
            "If the evidence does not support a reliable answer, do not guess. "
            "If the paper evidence supports multiple competing readings and user intent is still unresolved, ask for clarification instead of forcing a single interpretation."
        )

    def build_user_payload(
        self,
        *,
        paper: PaperRecord,
        query: str,
        plan: InterpretationPlan,
        history: list[dict[str, str]],
        fact_batch: FactExtractionBatch,
        hypothesis_packs: list[HypothesisEvidencePack],
    ) -> dict[str, object]:
        return {
            "paper": {
                "paper_id": paper.paper_id,
                "title": paper.title,
                "venue": paper.venue,
                "year": paper.year,
                "track": paper.track,
                "abstract": paper.abstract,
                "intro_summary": paper.intro_summary,
            },
            "query": query,
            "dialogue_state": plan.dialogue_state.model_dump(mode="json"),
            "interpretation_hypotheses": [item.model_dump(mode="json") for item in plan.hypotheses],
            "hypothesis_fact_sets": [item.model_dump(mode="json") for item in fact_batch.fact_sets],
            "history": history,
            "hypothesis_evidence_packs": [
                {
                    "hypothesis_id": item.hypothesis_id,
                    "normalized_question": item.normalized_question,
                    "target_relation": item.target_relation,
                    "target_objects": list(item.target_objects),
                    "required_constraints": list(item.required_constraints),
                    "disambiguation_focus": list(item.disambiguation_focus),
                    "competition_signal": item.competition_signal.model_dump(mode="json"),
                    "global_evidence": [evidence.model_dump(mode="json") for evidence in item.evidence_pack.global_evidence],
                    "local_evidence": [evidence.model_dump(mode="json") for evidence in item.evidence_pack.local_evidence],
                    "discriminative_evidence": [evidence.model_dump(mode="json") for evidence in item.discriminative_evidence],
                    "conflicting_evidence": [evidence.model_dump(mode="json") for evidence in item.conflicting_evidence],
                }
                for item in hypothesis_packs
            ],
            "required_output": GeneratedAnswer.model_json_schema(),
        }
