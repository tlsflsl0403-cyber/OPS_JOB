(function (global) {
  "use strict";

const namespace = global.OPSJOB || (global.OPSJOB = {});
const data = namespace.data || (namespace.data = {});
const jobs = Array.isArray(data.jobs) ? data.jobs : [];
const contests = Array.isArray(data.contests) ? data.contests : [];
const missions = Array.isArray(data.missions) ? data.missions : [];
const storage = namespace.storage;

const INTEREST_PROFILE_RECORD_EQUIVALENT = 1;
const STATUS = {
  enough: { label: "충분", className: "enough" },
  some: { label: "조금 부족", className: "some" },
  none: { label: "없음", className: "none" }
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function getInterestWeight(user, records) {
  if (user.userType !== 1 || !Array.isArray(user.testResult?.tempTags) || user.testResult.tempTags.length === 0) {
    return 0;
  }
  return INTEREST_PROFILE_RECORD_EQUIVALENT / (records.length + INTEREST_PROFILE_RECORD_EQUIVALENT);
}

function calculateJobMatch(job, user, records, tagCounts) {
  if (!job || !job.skills || !user || !Array.isArray(records) || !tagCounts) {
    return 0;
  }
  const skills = Object.entries(job.skills).filter(([, requiredLevel]) => Number(requiredLevel) > 0);
  if (skills.length === 0) {
    return 0;
  }

  const interestTags = new Set(user.userType === 1 ? user.testResult?.tempTags || [] : []);
  const interestWeight = getInterestWeight(user, records);
  const total = skills.reduce((sum, [tag, requiredLevel]) => {
    const rawScore = Math.min((tagCounts[tag] || 0) / requiredLevel, 1);
    const interestScore = interestTags.has(tag) ? 1 : 0;
    return sum + rawScore * (1 - interestWeight) + interestScore * interestWeight;
  }, 0);

  return total / skills.length;
}

function getStatus(current, required) {
  if (current >= required) {
    return STATUS.enough;
  }
  if (current > 0) {
    return STATUS.some;
  }
  return STATUS.none;
}

function getSkillRows(job, tagCounts) {
  if (!job || !job.skills || !tagCounts) {
    return [];
  }
  return Object.entries(job.skills)
    .map(([tag, required]) => {
      const current = tagCounts[tag] || 0;
      const ratio = Number(required) > 0 ? Math.min(current / required, 1) : 1;
      return { tag, required, current, ratio, status: getStatus(current, required) };
    })
    .sort((left, right) => left.ratio - right.ratio || left.tag.localeCompare(right.tag, "ko"));
}

function analyzeJob(job, records, tagCounts) {
  const skillRows = getSkillRows(job, tagCounts || {});
  const strengths = skillRows.filter((skill) => skill.current >= skill.required);
  const gaps = skillRows.filter((skill) => skill.current < skill.required);
  const priority = gaps[0] || null;

  return { skillRows, strengths, gaps, priority };
}

function tagPills(tags, counts = null) {
  return tags.map((tag) => {
    const count = counts ? `<span class="jc-tag-count">${counts[tag] || 0}회</span>` : "";
    return `<span class="jc-tag">${escapeHtml(tag)}${count}</span>`;
  }).join("");
}

function renderTabs(view) {
  const tabs = [
    ["matching", "직무 매칭"],
    ["analysis", "부족 역량 분석"],
    ["cards", "직무 탐색 카드"]
  ];
  return `<div class="jc-tabs" role="group" aria-label="직무 연결 메뉴">
    ${tabs.map(([id, label]) => `<button class="jc-tab" type="button" data-action="view" data-view="${id}" aria-pressed="${view === id}">${label}</button>`).join("")}
  </div>`;
}

function jobMatch(job, state) {
  return calculateJobMatch(job, state.user, state.records, state.tagCounts);
}

function renderProfile(state) {
  const usedTags = Object.keys(state.tagCounts).filter((tag) => state.tagCounts[tag] > 0);
  const profile = usedTags.length
    ? `<div class="jc-profile-tags">${tagPills(usedTags, state.tagCounts)}</div>`
    : `<p class="jc-empty">아직 등록된 역량 기록이 없습니다. 기록에 역량 태그를 추가하면 직무 매칭에 반영됩니다.</p>`;
  const interestNotice = state.user.userType === 1 && (state.user.testResult?.tempTags || []).length
    ? `<p class="jc-small-note">유형 1: 테스트 임시 관심 태그는 경험 기록이 쌓일수록 매칭 반영 비중이 줄어듭니다.</p>`
    : "";
  return `<section class="jc-card" aria-labelledby="jc-profile-title">
    <div class="jc-section-heading">
      <h2 id="jc-profile-title">내 역량 프로필</h2>
      <p>경험 기록 ${state.records.length}개</p>
    </div>
    ${profile}${interestNotice}
  </section>`;
}

function renderMatching(state) {
  const rankedJobs = [...jobs].sort((a, b) => jobMatch(b, state) - jobMatch(a, state));
  const cards = rankedJobs.map((job) => {
    const score = jobMatch(job, state);
    const existing = Object.keys(job.skills)
      .filter((tag) => state.tagCounts[tag] > 0)
      .slice(0, 3);
    const existingContent = existing.length
      ? `<div class="jc-tag-list" aria-label="이미 가진 역량">${tagPills(existing, state.tagCounts)}</div>`
      : `<p class="jc-small-note">아직 확인된 보유 역량이 없습니다.</p>`;
    const isTarget = state.user.targetJob === job.id;
    return `<article class="jc-card jc-job-card">
      <div>
        <div class="jc-section-heading">
          <h3>${escapeHtml(job.name)}</h3>
          ${isTarget ? '<span class="jc-badge jc-status--enough">목표 직무</span>' : ""}
        </div>
        <p>${escapeHtml(job.desc)}</p>
        ${existingContent}
      </div>
      <div class="jc-match">
        <strong>${formatPercent(score)}</strong>
        <span>매칭률</span>
        <div class="jc-progress" role="progressbar" aria-label="${escapeHtml(job.name)} 매칭률" aria-valuenow="${Math.round(score * 100)}" aria-valuemin="0" aria-valuemax="100">
          <span style="width:${Math.round(score * 100)}%"></span>
        </div>
        <button class="jc-button jc-button--secondary" type="button" data-action="analyze" data-job-id="${escapeHtml(job.id)}">역량 분석</button>
      </div>
    </article>`;
  }).join("");

  return `<section class="jc-panel" aria-label="직무 매칭 결과">
    ${renderProfile(state)}
    ${state.records.length < 3 ? `<div class="jc-notice jc-notice--info"><p><strong>경험이 3개 미만입니다.</strong> 경험 기록을 더 등록하면 현재 역량을 바탕으로 한 분석이 구체적이 됩니다.</p></div>` : ""}
    <div class="jc-section-heading">
      <h2>나와 가까운 직무</h2>
      <p>필요 역량별 충족도를 평균해 높은 순으로 표시합니다.</p>
    </div>
    ${cards ? `<div class="jc-job-list">${cards}</div>` : `<p class="jc-empty">표시할 직무 데이터가 없습니다.</p>`}
  </section>`;
}

function renderJobChips(state) {
  const ranked = [...jobs].sort((a, b) => jobMatch(b, state) - jobMatch(a, state));
  const topJobs = ranked.slice(0, 3);
  return topJobs.length
    ? `<div class="jc-job-chips" aria-label="분석할 직무 선택">
        ${topJobs.map((job) => `<button class="jc-job-chip" type="button" data-action="select-analysis-job" data-job-id="${escapeHtml(job.id)}" aria-pressed="${state.selectedJobId === job.id}">${escapeHtml(job.name)}</button>`).join("")}
      </div>`
    : `<p class="jc-empty">선택할 직무 데이터가 없습니다.</p>`;
}

function renderRecommendationCard(title, subtitle, tags, note = "") {
  return `<article class="jc-recommendation-card">
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(subtitle)}</p>
    ${note ? `<p class="jc-small-note">${escapeHtml(note)}</p>` : ""}
    <div class="jc-tag-list">${tagPills(tags)}</div>
  </article>`;
}

function renderContestRecommendation(contest) {
  const hostAndDeadline = [contest.host, contest.deadline ? `마감 ${contest.deadline}` : "예시 공고"].filter(Boolean).join(" · ");
  let contestUrl = null;
  try {
    contestUrl = contest.url ? new URL(contest.url, window.location.href) : null;
  } catch (error) {
    console.warn("공모전 링크 URL 형식이 올바르지 않습니다.", error);
  }
  const isExternalHttpLink = contestUrl && ["http:", "https:"].includes(contestUrl.protocol);
  const title = isExternalHttpLink
    ? `<a href="${escapeHtml(contestUrl.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(contest.title)}</a>`
    : escapeHtml(contest.title);
  return `<article class="jc-recommendation-card">
    <h3>${title}</h3>
    <p>${escapeHtml(hostAndDeadline)} · ${escapeHtml(contest.field)}</p>
    <p class="jc-small-note">부족한 ${escapeHtml(contest.tags.find((tag) => tag === contest._matchedTag) || "")} 역량과 연결되는 공고입니다.</p>
    <div class="jc-tag-list">${tagPills(contest.tags)}</div>
  </article>`;
}

function renderStrengths(strengths, records) {
  if (strengths.length === 0) {
    return `<p class="jc-empty">필요 수준을 충족한 강점 역량이 아직 없습니다. 기록이 쌓이면 근거 경험이 여기에 표시됩니다.</p>`;
  }
  return `<div class="jc-job-list">${strengths.map((skill) => {
    const evidence = records
      .filter((record) => Array.isArray(record.tags) && record.tags.includes(skill.tag))
      .slice(0, 2);
    const evidenceText = evidence.length
      ? evidence.map((record) => record.title || record.content || "제목 없는 기록").join(" · ")
      : "태그 집계에 해당하는 기록을 확인할 수 없습니다.";
    return `<div>
      <div class="jc-section-heading">
        <h3>${escapeHtml(skill.tag)}</h3>
        <span class="jc-status jc-status--enough">강점 · ${skill.current}/${skill.required}</span>
      </div>
      <p class="jc-evidence">근거 경험: ${escapeHtml(evidenceText)}</p>
      <button class="jc-button jc-button--secondary" type="button" data-action="star" data-tag="${escapeHtml(skill.tag)}">STAR 정리하기</button>
    </div>`;
  }).join("")}</div>`;
}

function drawRadar(root, job, skillRows, renderVersion, getRenderVersion) {
  const canvas = root.querySelector("[data-role='skill-chart']");
  if (!canvas) {
    return;
  }
  if (renderVersion !== getRenderVersion() || !canvas.isConnected) {
    return null;
  }
  if (typeof global.Chart !== "function") {
    const notice = document.createElement("p");
    notice.className = "jc-notice jc-notice--warn";
    notice.textContent = "차트를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.";
    canvas.replaceWith(notice);
    return null;
  }
  if (skillRows.length === 0) {
    const notice = document.createElement("p");
    notice.className = "jc-empty";
    notice.textContent = "이 직무에는 비교할 필요 역량이 등록되어 있지 않습니다.";
    canvas.replaceWith(notice);
    return null;
  }
  try {
    return new global.Chart(canvas, {
      type: "radar",
      data: {
        labels: skillRows.map((skill) => skill.tag),
        datasets: [
          {
            label: "필요 수준",
            data: skillRows.map((skill) => skill.required)
          },
          {
            label: "내 수준",
            data: skillRows.map((skill) => Math.min(skill.current, skill.required))
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: Math.max(...skillRows.map((skill) => skill.required)),
            ticks: { precision: 0, stepSize: 1 }
          }
        }
      }
    });
  } catch (error) {
    console.error("직무 역량 차트를 생성하지 못했습니다.", error);
    const notice = document.createElement("p");
    notice.className = "jc-notice jc-notice--warn";
    notice.textContent = "차트를 표시하지 못했습니다.";
    canvas.replaceWith(notice);
    return null;
  }
}

function renderAnalysis(state) {
  const job = jobs.find((item) => item.id === state.selectedJobId);
  if (!job) {
    return `<section class="jc-panel" aria-label="부족 역량 분석">
      <div class="jc-notice jc-notice--info"><p>분석할 직무 데이터가 없습니다. 직무 데이터 파일을 확인해 주세요.</p></div>
    </section>`;
  }
  const score = jobMatch(job, state);
  const { skillRows, strengths, gaps, priority } = analyzeJob(job, state.records, state.tagCounts);
  const contest = priority
    ? contests.find((item) => Array.isArray(item.tags) && item.tags.includes(priority.tag))
    : null;
  const mission = priority
    ? missions.find((item) => Array.isArray(item.tags) && item.tags.includes(priority.tag))
    : null;
  const isTarget = state.user.targetJob === job.id;

  const skillTable = skillRows.map((skill) => `<tr>
    <td>${escapeHtml(skill.tag)}</td>
    <td>${skill.required}</td>
    <td>${skill.current}</td>
    <td><span class="jc-status jc-status--${skill.status.className}">${skill.status.label}</span></td>
  </tr>`).join("");
  const table = `<div class="jc-table-wrap">
    <table class="jc-skill-table">
      <thead><tr><th scope="col">역량 태그</th><th scope="col">필요 수준</th><th scope="col">내 수준(경험 수)</th><th scope="col">상태</th></tr></thead>
      <tbody>${skillTable}</tbody>
    </table>
  </div>`;
  const recommendations = priority
    ? `<div class="jc-recommendation">
        ${contest
          ? renderContestRecommendation({ ...contest, _matchedTag: priority.tag })
          : renderRecommendationCard("연결된 공모전이 없습니다", `${priority.tag} 역량 태그가 있는 공모전이 등록되지 않았습니다.`, [priority.tag])}
        ${mission
          ? renderRecommendationCard(mission.title, `체험 미션 · 약 ${mission.minutes}분`, mission.tags, `부족한 ${priority.tag} 역량을 연습해 보세요.`)
          : renderRecommendationCard("연결된 미션이 없습니다", `${priority.tag} 역량 태그가 있는 미션이 등록되지 않았습니다.`, [priority.tag])}
      </div>`
    : skillRows.length > 0
      ? `<div class="jc-notice jc-notice--good"><p><strong>필요 역량이 모두 충족되었습니다.</strong> 포트폴리오를 완성해 현재 역량을 보여주세요.</p></div>`
      : `<div class="jc-notice jc-notice--info"><p>이 직무에는 분석할 필요 역량이 등록되어 있지 않습니다.</p></div>`;

  return `<section class="jc-panel" aria-label="부족 역량 분석">
    <section class="jc-card">
      <div class="jc-section-heading"><h2>분석할 직무</h2></div>
      ${renderJobChips(state)}
      <div class="jc-analysis-summary jc-section-spaced">
        <div><h2>${escapeHtml(job.name)}</h2><p>${escapeHtml(job.desc)}</p></div>
        <div class="jc-score">${formatPercent(score)}<span class="jc-small-note"> 매칭</span></div>
      </div>
      <div class="jc-actions jc-section-spaced">
        <button class="jc-button" type="button" data-action="set-target" data-job-id="${escapeHtml(job.id)}" aria-pressed="${isTarget}">${isTarget ? "목표 직무로 설정됨" : "목표 직무로 설정"}</button>
      </div>
    </section>
    ${state.records.length < 3 ? `<div class="jc-notice jc-notice--warn">
      <p><strong>경험 기록이 3개 미만입니다.</strong> 경험이 충분하지 않아 분석이 제한적일 수 있습니다.</p>
      <p><button class="jc-button jc-button--secondary" type="button" data-action="navigate" data-destination="experience-extraction">경험 꺼내기 안내</button></p>
    </div>` : ""}
    <div class="jc-analysis-grid">
      <section class="jc-card">
        <div class="jc-section-heading"><h2>필요 역량과 현재 역량</h2><p>현재 수준은 해당 태그가 포함된 경험 수입니다.</p></div>
        ${table}
      </section>
      <section class="jc-card">
        <div class="jc-section-heading"><h2>역량 비교</h2></div>
        <div class="jc-chart"><canvas data-role="skill-chart" role="img" aria-label="${escapeHtml(job.name)} 필요 역량과 현재 역량 레이더 차트"></canvas></div>
      </section>
    </div>
    ${priority
      ? `<section class="jc-card">
          <div class="jc-section-heading"><h2>먼저 채우면 좋은 역량</h2><span class="jc-status jc-status--${priority.status.className}">${escapeHtml(priority.tag)} · ${formatPercent(priority.ratio)} 충족</span></div>
          ${recommendations}
        </section>`
      : `<section class="jc-card">
          ${recommendations}
        </section>`}
    <section class="jc-card">
      <div class="jc-section-heading"><h2>이미 강점인 역량과 근거 경험</h2></div>
      ${renderStrengths(strengths, state.records)}
    </section>
  </section>`;
}

function renderCards(state) {
  const cards = jobs.map((job) => `<article class="jc-card jc-job-detail">
    <div>
      <h2>${escapeHtml(job.name)}</h2>
      <p>${escapeHtml(job.desc)}</p>
    </div>
    <div class="jc-detail-block">
      <h3>필요 역량</h3>
      <div class="jc-tag-list">${tagPills(Object.keys(job.skills))}</div>
    </div>
    <div class="jc-detail-block">
      <h3>관련 학과(예시)</h3>
      <p>${job.majors.map(escapeHtml).join(" · ")}</p>
    </div>
    <div class="jc-detail-block">
      <h3>관련 자격(예시)</h3>
      <p>${job.certifications.map(escapeHtml).join(" · ")}</p>
    </div>
    <div class="jc-detail-block">
      <h3>하는 일(예시)</h3>
      <ul>${job.tasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>
    </div>
    <div class="jc-detail-block">
      <h3>준비 활동(예시)</h3>
      ${Array.isArray(job.activities) && job.activities.length
        ? `<ul>${job.activities.map((activity) => `<li>${escapeHtml(activity)}</li>`).join("")}</ul>`
        : `<p class="jc-empty">등록된 준비 활동 예시가 없습니다.</p>`}
    </div>
  </article>`).join("");

  return `<section class="jc-panel" aria-label="직무 탐색 카드">
    <div class="jc-notice jc-notice--info"><p>커리어넷 오픈API는 연결되어 있지 않으며 승인·인증키 상태를 확인할 수 없습니다. 아래 직무 설명·업무·학과·자격은 검증되지 않은 프로젝트 예시 데이터입니다.</p></div>
    ${cards ? `<div class="jc-job-explorer">${cards}</div>` : `<p class="jc-empty">표시할 직무 데이터가 없습니다.</p>`}
  </section>`;
}

function renderError(root, message) {
  root.innerHTML = `<div class="jc-notice jc-notice--error" role="alert">${escapeHtml(message)}</div>`;
}

function emitNavigation(destination, detail = {}) {
  document.dispatchEvent(new CustomEvent("selfdev:navigate", {
    detail: { destination, ...detail }
  }));
}

function mountJobConnection(root, storageApi = storage) {
  if (!root) {
    throw new TypeError("직무 연결을 표시할 루트 요소가 필요합니다.");
  }
  for (const method of ["getUser", "getRecords", "getTagCounts", "saveUser"]) {
    if (!storageApi || typeof storageApi[method] !== "function") {
      throw new TypeError(`직무 연결 저장 어댑터에 ${method}() 함수가 필요합니다.`);
    }
  }
  let chart = null;
  let chartRenderVersion = 0;
  const state = {
    view: "matching",
    selectedJobId: jobs[0]?.id,
    user: {},
    records: [],
    tagCounts: {},
    feedback: "",
    initialized: false
  };

  function loadData() {
    state.user = storageApi.getUser() || {};
    state.records = storageApi.getRecords() || [];
    const tagCounts = storageApi.getTagCounts() || {};
    if (!Array.isArray(state.records)) {
      throw new TypeError("저장소가 배열 형태의 경험 기록을 반환해야 합니다.");
    }
    if (!state.user || typeof state.user !== "object" || Array.isArray(state.user)) {
      throw new TypeError("저장소가 객체 형태의 사용자 정보를 반환해야 합니다.");
    }
    if (!tagCounts || typeof tagCounts !== "object" || Array.isArray(tagCounts)) {
      throw new TypeError("저장소가 태그별 경험 수 객체를 반환해야 합니다.");
    }
    state.tagCounts = Object.fromEntries(
      Object.entries(tagCounts).map(([tag, count]) => [tag, Math.max(0, Number(count) || 0)])
    );
    if (!state.initialized) {
      const rankedJobs = [...jobs].sort((a, b) => jobMatch(b, state) - jobMatch(a, state));
      const targetIsInTopJobs = rankedJobs.slice(0, 3).some((job) => job.id === state.user.targetJob);
      if (targetIsInTopJobs) {
        state.selectedJobId = state.user.targetJob;
      } else {
        state.selectedJobId = rankedJobs[0]?.id;
      }
      state.initialized = true;
    }
  }

  function render() {
    const renderVersion = ++chartRenderVersion;
    if (chart) {
      chart.destroy();
      chart = null;
    }
    const viewContent = state.view === "analysis"
      ? renderAnalysis(state)
      : state.view === "cards"
        ? renderCards(state)
        : renderMatching(state);
    root.innerHTML = `<h1 class="jc-title">직무 연결</h1>
    ${renderTabs(state.view)}
    ${state.feedback ? `<div class="jc-notice jc-notice--info" role="status">${escapeHtml(state.feedback)}</div>` : ""}
    ${viewContent}`;
    if (state.view === "analysis" && state.selectedJobId) {
      const job = jobs.find((item) => item.id === state.selectedJobId);
      if (!job) {
        return;
      }
      chart = drawRadar(root, job, getSkillRows(job, state.tagCounts), renderVersion, () => chartRenderVersion);
    }
  }

  function refresh() {
    try {
      loadData();
      render();
    } catch (error) {
      chartRenderVersion += 1;
      if (chart) {
        chart.destroy();
        chart = null;
      }
      console.error("직무 연결 데이터를 불러오지 못했습니다.", error);
      renderError(root, error.message || "직무 연결 데이터를 불러오지 못했습니다.");
    }
  }

  function handleClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || !root.contains(button)) {
      return;
    }

    const { action, jobId } = button.dataset;
    state.feedback = "";
    if (action === "view") {
      state.view = button.dataset.view;
    } else if (action === "analyze" || action === "select-analysis-job") {
      state.selectedJobId = jobId;
      state.view = "analysis";
    } else if (action === "navigate") {
      emitNavigation(button.dataset.destination);
      state.feedback = "경험 꺼내기 화면으로 이동 요청을 전달했습니다. 전체 서비스 통합 시 해당 메뉴와 연결됩니다.";
    } else if (action === "star") {
      emitNavigation("portfolio-star", {
        jobId: state.selectedJobId,
        tag: button.dataset.tag
      });
      state.feedback = "STAR 정리 화면으로 이동 요청을 전달했습니다. 포트폴리오 메뉴와 연결됩니다.";
    } else if (action === "set-target") {
      try {
        const updatedUser = { ...state.user, targetJob: jobId };
        storageApi.saveUser(updatedUser);
        state.user = updatedUser;
        state.feedback = "목표 직무를 저장했습니다.";
      } catch (error) {
        state.feedback = `목표 직무 저장 실패: ${error.message}`;
      }
    }
    refresh();
  }

  root.addEventListener("click", handleClick);
  refresh();
  return {
    refresh,
    destroy() {
      chartRenderVersion += 1;
      if (chart) {
        chart.destroy();
      }
      root.removeEventListener("click", handleClick);
      root.replaceChildren();
    }
  };
}

namespace.mountJobConnection = mountJobConnection;
namespace.calculateJobMatch = calculateJobMatch;
namespace.analyzeJob = analyzeJob;
})(window);
