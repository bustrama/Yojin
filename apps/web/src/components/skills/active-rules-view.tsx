import { useState } from 'react';

import SkillCard from './skill-card.js';
import SkillDetailModal from './skill-detail-modal.js';
import Spinner from '../common/spinner.js';
import { useSkills, useToggleSkill } from '../../api/hooks/index.js';
import type { Skill } from './types.js';

export default function ActiveRulesView() {
  const [result] = useSkills();
  const [, toggleSkill] = useToggleSkill();
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const skills = result.data?.skills ?? [];
  const active = skills.filter((s) => s.active);
  const available = skills.filter((s) => !s.active);

  function handleToggle(id: string, newActive: boolean) {
    toggleSkill({ id, active: newActive });
  }

  if (result.fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner label="Loading strategies..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">Active ({active.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onToggle={handleToggle} onClick={setSelectedSkill} />
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">Available ({available.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onToggle={handleToggle} onClick={setSelectedSkill} />
            ))}
          </div>
        </section>
      )}

      {skills.length === 0 && !result.fetching && (
        <div className="text-center py-20 text-text-muted">
          <p className="text-sm">No strategies yet.</p>
        </div>
      )}

      {selectedSkill && (
        <SkillDetailModal open={!!selectedSkill} skillId={selectedSkill.id} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
