(function (global) {
  "use strict";

  const namespace = global.OPSJOB || (global.OPSJOB = {});
  const data = namespace.data || (namespace.data = {});
  data.contests = [
  {
    id: "sample-service-planning",
    title: "[예시] 대학생 서비스 기획 공모전",
    host: "데모 데이터",
    deadline: "",
    field: "서비스 기획",
    tags: ["기획", "사용자 리서치", "발표"],
    url: ""
  },
  {
    id: "sample-data-analysis",
    title: "[예시] 데이터 활용 아이디어 챌린지",
    host: "데모 데이터",
    deadline: "",
    field: "데이터 분석",
    tags: ["데이터 분석", "기획", "발표"],
    url: ""
  },
  {
    id: "sample-content",
    title: "[예시] 캠퍼스 콘텐츠 제작 공모전",
    host: "데모 데이터",
    deadline: "",
    field: "콘텐츠 제작",
    tags: ["영상", "글쓰기", "디자인"],
    url: ""
  }
  ];
})(window);
