import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Building2, ChevronRight, Star, UserPlus } from 'lucide-react';
import { PEOPLE } from '../../r01/src/people.js';
import './style.css';

const TABS = ['概览', '研究成果', '临床研究', '指南与贡献', '合作网络', '研究团队'];
const TAG_DIMENSIONS = [
  ['抑郁障碍', '疾病方向', '抑郁障碍'],
  ['焦虑障碍', '疾病方向', '焦虑障碍'],
  ['针灸治疗', '干预方向', '针灸'],
  ['心理治疗', '干预方向', '心理治疗'],
  ['药物治疗', '干预方向', '药物治疗'],
  ['神经调控', '干预方向', '神经调控'],
  ['数字医疗', '干预方向', '数字医疗'],
  ['临床试验', '临床研究', '临床试验'],
  ['临床队列', '临床研究', '临床队列'],
  ['临床干预', '临床研究', '临床干预'],
  ['临床应用', '临床研究', '临床应用'],
  ['神经影像', '机制研究', '神经影像'],
  ['脑功能成像', '机制研究', '脑功能成像'],
  ['机制研究', '机制研究', '机制研究'],
];

function asDirections(person) {
  const rows = person.directions || person.tags.slice(0, 4).map((tag) => [tag, '']);
  return rows.map((row) => (Array.isArray(row)
    ? { title: row[0], text: row[1], kind: person.directionKind || '归纳' }
    : { kind: person.directionKind || '归纳', ...row }));
}

function asPaper(row) {
  if (!Array.isArray(row)) return row;
  return { title: row[0], authors: row[1], venue: row[2], cite: row[3], role: '' };
}

function asTrial(row) {
  if (!Array.isArray(row)) return row;
  return { title: row[0], code: row[1], design: row[2], status: row[3], role: '' };
}

function asGuide(item) {
  return typeof item === 'string' ? { title: item, role: '' } : item;
}

function affiliationsOf(person) {
  if (person.affiliations?.length) return person.affiliations;
  const org = person.org.split(' ')[0];
  const unit = person.dept || person.org.split(' ').slice(1).join(' ');
  return [{ current: true, org, unit, title: person.rank, period: '' }];
}

function teamsOf(person) {
  if (person.teams?.length) return person.teams;
  if (!person.teamId) return [];
  return [{ id: person.teamId, name: person.teamName, role: person.teamRole, core: true }];
}

function dimensionsOf(person) {
  if (person.hubDimensions?.length) return person.hubDimensions;
  const seen = new Set();
  return TAG_DIMENSIONS.flatMap(([tag, label, value]) => {
    if (!person.tags.includes(tag) || seen.has(label)) return [];
    seen.add(label);
    return [[label, value, 'match']];
  });
}

function fill(person) {
  const affiliations = affiliationsOf(person);
  const current = affiliations.find((item) => item.current) || affiliations[0];
  const guides = (person.guides || []).map(asGuide);
  const partners = person.partners || [];
  return {
    ...person,
    intro: person.intro || person.summary,
    directions: asDirections(person),
    dimensions: dimensionsOf(person),
    reasons: person.relevance || [person.summary],
    works: (person.works || []).map(asPaper),
    trialRows: (person.trialRows || []).map(asTrial),
    guides,
    partners,
    coResearchers: person.coResearchers || [],
    projectNames: person.projectNames || [],
    affiliations,
    current,
    history: affiliations.filter((item) => !item.current),
    education: person.education || [],
    teams: teamsOf(person),
    identifiers: [
      person.orcid && ['ORCID', person.orcid],
      person.homepage && ['公开主页', person.homepage],
      person.orgPage && ['机构主页', person.orgPage],
    ].filter(Boolean),
  };
}

function App() {
  const id = new URLSearchParams(window.location.search).get('id') || 'wang';
  const person = fill(PEOPLE.find((item) => item.id === id) || PEOPLE[0]);
  const [tab, setTab] = useState('概览');
  const [resultTab, setResultTab] = useState('论文');
  const [followed, setFollowed] = useState(false);
  const [invited, setInvited] = useState(false);
  const unit = person.current.unit ? ` · ${person.current.unit}` : '';

  return (
    <main className="platform-main profile-board">
      <section className="profile-hero">
        <img src={person.photo} alt="" />
        <div>
          <header>
            <h2>{person.name}</h2>
            {person.badges.map((badge) => <em key={badge}>{badge}</em>)}
            <div>
              <button type="button" onClick={() => setFollowed((value) => !value)}><Star size={14} />{followed ? '已关注' : '关注'}</button>
              <button type="button" onClick={() => setInvited(true)}><UserPlus size={14} />{invited ? '已添加合作意向' : '添加到合作'}</button>
            </div>
          </header>
          <p className="profile-post">当前任职：{person.current.org}{unit}</p>
          {person.identifiers.length > 0 && (
            <p className="profile-ids">{person.identifiers.map(([label, value]) => <span key={label}>{label}　{value}</span>)}</p>
          )}
          <p className="profile-focus">研究方向　<em>{person.directions[0]?.kind === '明确' ? '来源明确' : '岐研归纳'}</em>{person.directions.slice(0, 3).map((item) => item.title).join(' · ')}</p>
        </div>
        <div className="profile-stats">
          <p><b>{person.papers}</b><small>关联论文</small></p>
          <p><b>{person.trials}</b><small>参与临床研究</small></p>
          <p><b>{person.guides.length}</b><small>参与指南/共识</small></p>
          <p><b>{person.partners.length}</b><small>合作机构</small></p>
        </div>
      </section>
      <div className="profile-tabs">
        {TABS.map((item) => <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="profile-split">
        <div className="profile-main">
          {tab === '概览' && <Overview person={person} resultTab={resultTab} setResultTab={setResultTab} onMore={setTab} />}
          {tab === '研究成果' && <section><h3>研究成果</h3><Results person={person} resultTab={resultTab} setResultTab={setResultTab} /></section>}
          {tab === '临床研究' && <Trials person={person} />}
          {tab === '指南与贡献' && <section><h3>参与的指南与共识</h3><Guides items={person.guides} /></section>}
          {tab === '合作网络' && <Network person={person} />}
          {tab === '研究团队' && <TeamList person={person} />}
        </div>
        <Rail person={person} />
      </div>
    </main>
  );
}

function Overview({ person, resultTab, setResultTab, onMore }) {
  const [open, setOpen] = useState(false);
  const matched = person.dimensions.filter((row) => row[2] === 'match').length;
  return (
    <>
      <div className="profile-intro">
        <section>
          <h3>研究简介</h3>
          <p>{person.intro}</p>
        </section>
        <section className="profile-fit">
          <h3>与本研究领域的相关性</h3>
          <p className="profile-match-count">当前 Hub 匹配：{matched} 个研究维度</p>
          <ul className="profile-dims">
            {person.dimensions.map(([label, value, tone]) => (
              <li key={label} className={tone}>{tone === 'partial' ? '△' : '✓'}　{label}：{value}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setOpen((value) => !value)}>为什么属于这个 Hub<ChevronRight size={14} /></button>
          {open && <ul className="profile-reasons">{person.reasons.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>
      </div>
      <section>
        <h3>核心研究方向</h3>
        <div className="profile-dirs">
          {person.directions.map((item) => (
            <article key={item.title}>
              <em>{item.kind === '明确' ? '来源明确' : '岐研归纳'}</em>
              <b>{item.title}</b>
              {item.text && <span>{item.text}</span>}
              {item.kind === '明确' && item.source && <small>{item.source}</small>}
            </article>
          ))}
        </div>
      </section>
      <section>
        <header><h3>代表性研究成果</h3><button type="button" onClick={() => onMore('研究成果')}>查看更多<ChevronRight size={14} /></button></header>
        <Results person={person} resultTab={resultTab} setResultTab={setResultTab} />
      </section>
    </>
  );
}

function Results({ person, resultTab, setResultTab }) {
  return (
    <>
      <div className="profile-result-tabs">
        {[['论文', person.papers], ['临床试验', person.trials], ['指南/共识', person.guides.length]].map(([label, count]) => (
          <button key={label} type="button" className={resultTab === label ? 'on' : ''} onClick={() => setResultTab(label)}>{label}（{count}）</button>
        ))}
      </div>
      {resultTab === '论文' && (
        person.works.length ? (
          <ul className="profile-papers">
            {person.works.map((row) => (
              <li key={row.title}>
                <b>{row.title}{row.role && <em>{row.role}</em>}</b>
                <span>{row.authors}　{row.venue} {row.cite}</span>
              </li>
            ))}
          </ul>
        ) : <p className="profile-empty">暂无已关联的论文。</p>
      )}
      {resultTab === '临床试验' && <TrialList rows={person.trialRows} />}
      {resultTab === '指南/共识' && <Guides items={person.guides} />}
    </>
  );
}

function Trials({ person }) {
  return (
    <section>
      <h3>参与的临床研究</h3>
      <TrialList rows={person.trialRows} />
      {person.projectNames.length > 0 && (
        <div className="profile-projects">
          <h3>相关课题</h3>
          <ul className="profile-lines">{person.projectNames.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>课题名称来自公开信息，不表示均由本人主导。</p>
        </div>
      )}
    </section>
  );
}

function TrialList({ rows }) {
  if (!rows.length) return <p className="profile-empty">暂无公开的临床研究。</p>;
  return (
    <ul className="profile-lines">
      {rows.map((row) => (
        <li key={row.title}>
          <b>{row.title}{row.role && <em>{row.role}</em>}</b>
          <span>{row.code}　{row.design}　{row.status}</span>
        </li>
      ))}
    </ul>
  );
}

function Guides({ items }) {
  if (!items.length) return <p className="profile-empty">暂无公开指南或共识。</p>;
  return (
    <ul className="profile-lines">
      {items.map((item) => <li key={item.title}><b>{item.title}{item.role && <em>{item.role}</em>}</b></li>)}
    </ul>
  );
}

function Network({ person }) {
  return (
    <>
      <section>
        <h3>主要合作机构</h3>
        <OrgList items={person.partners} />
      </section>
      <section>
        <h3>共同研究者</h3>
        <PeopleList people={person.coResearchers} />
      </section>
    </>
  );
}

function OrgList({ items }) {
  if (!items.length) return <p className="profile-empty">暂无已确认的合作机构。</p>;
  return <ul className="profile-lines">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function PeopleList({ people }) {
  if (!people.length) return <p className="profile-empty">还没有对应到平台研究者的共同作者。</p>;
  return (
    <ul className="profile-lines">
      {people.map((item) => <li key={item.name}><b>{item.name}{item.role && <em>{item.role}</em>}</b></li>)}
    </ul>
  );
}

function TeamList({ person, plain = false }) {
  const core = person.teams.filter((item) => item.core);
  const others = person.teams.filter((item) => !item.core);
  if (!person.teams.length) return <p className="profile-empty">暂无已关联的研究团队。</p>;
  return (
    <>
      {core.length > 0 && <TeamGroup plain={plain} title="当前核心团队" teams={core} />}
      {others.length > 0 && <TeamGroup plain={plain} title="其他参与团队" teams={others} />}
    </>
  );
}

function TeamGroup({ title, teams, plain }) {
  const content = (
    <>
      {plain ? <p className="profile-kicker">{title}</p> : <h3>{title}</h3>}
      {teams.map((team) => <TeamCard key={team.id} team={team} />)}
    </>
  );
  return plain ? content : <section>{content}</section>;
}

function TeamCard({ team }) {
  return (
    <button type="button" className="profile-team" onClick={(event) => { event.stopPropagation(); window.location.assign(`/pages/t02/?team=${team.id}`); }}>
      <b>{team.name}</b>
      <span>{team.role}<ChevronRight size={14} /></span>
    </button>
  );
}

function Rail({ person }) {
  const [full, setFull] = useState(false);
  const history = full ? person.history : person.history.slice(0, 3);
  const unit = person.current.unit ? ` · ${person.current.unit}` : '';
  return (
    <aside className="profile-side">
      <section>
        <h3>当前任职</h3>
        <p className="profile-org"><Building2 size={16} /><span><b>{person.current.org}{unit}</b><small>{person.current.title}</small>{person.current.period && <small>{person.current.period}</small>}</span></p>
        {person.current.source && <p>任职信息来源：{person.current.source}</p>}
        {person.current.confirmedAt && <p>最近确认时间：{person.current.confirmedAt}</p>}
      </section>
      <section>
        <h3>研究团队</h3>
        <TeamList person={person} plain />
      </section>
      <section>
        <h3>主要合作机构</h3>
        <OrgList items={person.partners} />
      </section>
      <section>
        <h3>共同研究者</h3>
        <PeopleList people={person.coResearchers} />
      </section>
      <section>
        <h3>任职经历</h3>
        {history.length === 0 && <p className="profile-empty">暂无已确认的历史任职。</p>}
        <ol>
          {history.map((item) => <li key={`${item.period}${item.title}`}><b>{item.period || '历史任职'}</b><span>{item.org}{item.unit ? ` · ${item.unit}` : ''}　{item.title}</span></li>)}
          {full && person.education.map((item) => <li key={item.period}><b>{item.period}</b><span>{item.text}</span></li>)}
        </ol>
        {(person.history.length > 3 || person.education.length > 0) && (
          <button type="button" className="profile-more" onClick={() => setFull((value) => !value)}>{full ? '收起经历' : '查看完整经历'}<ChevronRight size={14} /></button>
        )}
      </section>
    </aside>
  );
}

createRoot(document.getElementById('root')).render(<App />);
