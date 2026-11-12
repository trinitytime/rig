// 대시보드 클라이언트: 컨트롤 이벤트를 서버로 보내고, 서버가 알리면 화면을 다시 받아 바뀐 부분만 교체한다.
(() => {
  const { page, base } = document.body.dataset;
  const leaves = (root) => [...root.querySelectorAll("[data-k]")];

  const post = (id, value) =>
    fetch(`${base}event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page, id, value }) });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.dataset.ev) return;
    if (!el.checkValidity()) return void el.reportValidity();
    post(el.dataset.ev, el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value);
  });
  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element && e.target.closest("button[data-ev]");
    if (b) post(b.dataset.ev);
  });

  // shortcut: 항목 구성이 바뀌면 main 전체를 바꿔 섹션 접힘 상태가 초기화되고, 같은 HTML이면 교체하지 않아 입력 중인 값은 남는다. 필요해지면 접힘 상태를 보존.
  const sync = (a, b) => {
    const [o, n] = [leaves(a), leaves(b)];
    if (o.map((e) => e.dataset.k).join() !== n.map((e) => e.dataset.k).join()) return void (a.innerHTML = b.innerHTML);
    n.forEach((e, i) => {
      if (!o[i].contains(document.activeElement) && o[i].outerHTML !== e.outerHTML) o[i].replaceWith(e);
    });
  };

  const reload = async () => {
    const res = await fetch(location.href);
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    if (doc.body.dataset.page !== page) return location.reload(); // 현재 화면이 사라졌거나 바뀜
    document.title = doc.title;
    const [nav, newNav] = [document.querySelector(".rig-nav-list"), doc.querySelector(".rig-nav-list")];
    if (nav && newNav && !nav.contains(document.activeElement) && nav.innerHTML !== newNav.innerHTML) nav.innerHTML = newNav.innerHTML;
    sync(document.querySelector("main"), doc.querySelector("main"));
  };

  const es = new EventSource(`${base}events`);
  es.onmessage = reload;
  es.onopen = reload; // 재연결 사이에 놓친 변경을 따라잡는다
})();
