'use client';

export function TeamsView() {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">Teams & Automated Allocation Rules</h2></div>
      <div>
        <table className="data-table">
          <thead><tr><th>Team Name</th><th>Tech Pool</th><th>Lead AM</th><th>TA Count</th><th>Rule</th></tr></thead>
          <tbody>
            {[
              { team: 'Java & Fullstack Alpha', tech: 'Java, Spring, React', lead: 'AM 1', count: 8, rule: 'Auto-allocate Java/React demands' },
              { team: 'Cloud & DevOps Beta', tech: 'AWS, Azure, Terraform', lead: 'AM 2', count: 5, rule: 'Auto-allocate Cloud demands' },
            ].map((t, idx) => (
              <tr key={idx}>
                <td className="font-semibold text-[#0f172a]">{t.team}</td><td>{t.tech}</td><td>{t.lead}</td><td>{t.count} TAs</td><td>{t.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
