(function (global) {
  "use strict";

  const namespace = global.OPSJOB || (global.OPSJOB = {});
  const data = namespace.data || (namespace.data = {});
  data.missions = [
  { id: "interview-three", title: "자주 쓰는 앱에 대해 친구 3명 인터뷰하기", tags: ["사용자 리서치"], minutes: 60 },
  { id: "plan-service", title: "불편한 일상 문제를 골라 서비스 아이디어 한 장으로 정리하기", tags: ["기획", "글쓰기"], minutes: 45 },
  { id: "make-poster", title: "관심 있는 주제로 정보 포스터 한 장 만들기", tags: ["디자인"], minutes: 50 },
  { id: "web-page", title: "관심 주제를 소개하는 반응형 웹 페이지 만들기", tags: ["개발", "디자인"], minutes: 90 },
  { id: "analyze-survey", title: "간단한 설문 10개 응답을 표와 그래프로 정리하기", tags: ["데이터 분석"], minutes: 45 },
  { id: "short-video", title: "관심 주제를 30초 영상으로 기획하고 편집하기", tags: ["영상", "기획"], minutes: 60 },
  { id: "present-idea", title: "내 아이디어를 3분 발표 자료로 설명하기", tags: ["발표", "기획"], minutes: 45 },
  { id: "team-retro", title: "최근 함께한 활동에서 협업 방식을 돌아보고 개선점 적기", tags: ["협업", "글쓰기"], minutes: 30 }
  ];
})(window);
