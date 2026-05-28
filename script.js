(function () {
  const data = window.resumeData;
  const root = document.documentElement;
  const storedTheme = localStorage.getItem("resume-theme");

  if (storedTheme) {
    root.dataset.theme = storedTheme;
  }

  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  };

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const makeLink = (item, className) => {
    const link = document.createElement("a");
    link.className = className;
    link.href = item.href;
    link.textContent = item.label;
    if (item.href === "#") {
      link.setAttribute("aria-disabled", "true");
    } else if (item.href.startsWith("http")) {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    return link;
  };

  setText("[data-field='name']", data.name);
  setText("[data-field='role']", data.role);
  setText("[data-field='location']", data.location);
  setText("[data-field='summary']", data.summary);
  document.title = `Resume | ${data.name}`;

  const initials = data.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  document.querySelector("[data-initials]").textContent = initials || "CV";

  const cvModal = makeElement("dialog", "cv-modal");
  const cvPanel = makeElement("div", "cv-modal-panel");
  const cvHeader = makeElement("div", "cv-modal-header");
  const cvTitle = makeElement("p", "", "Download CV");
  const cvClose = makeElement("button", "cv-modal-close", "Close");
  const cvChoices = makeElement("div", "cv-choice-grid");
  const cvFiles = [
    { label: "EN", title: "English version", href: "assets/arsenij-arsiriy-resume-en.pdf", file: "Arsenij_Arsiriy_Resume_ENG.pdf" },
    { label: "PL", title: "Polish version", href: "assets/arsenij-arsiriy-resume-pl.pdf", file: "Arsenij_Arsiriy_Resume_PL.pdf" }
  ];

  cvClose.type = "button";
  cvClose.setAttribute("aria-label", "Close CV download choices");
  cvHeader.appendChild(cvTitle);
  cvHeader.appendChild(cvClose);
  cvFiles.forEach((file) => {
    const link = document.createElement("a");
    link.className = `cv-choice cv-choice--${file.label.toLowerCase()}`;
    link.href = file.href;
    link.download = file.file;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.appendChild(makeElement("span", "cv-choice-code", file.label));
    link.appendChild(makeElement("span", "cv-choice-title", file.title));
    cvChoices.appendChild(link);
  });
  cvPanel.appendChild(cvHeader);
  cvPanel.appendChild(cvChoices);
  cvModal.appendChild(cvPanel);
  document.body.appendChild(cvModal);

  const openCvModal = () => {
    cvModal.classList.remove("is-open", "is-closing");
    if (typeof cvModal.showModal === "function") {
      cvModal.showModal();
    } else {
      cvModal.setAttribute("open", "");
    }
    requestAnimationFrame(() => {
      cvModal.classList.add("is-open");
    });
  };

  const closeCvModal = () => {
    if (!cvModal.open) return;
    cvModal.classList.remove("is-open");
    cvModal.classList.add("is-closing");
    window.setTimeout(() => {
      if (typeof cvModal.close === "function" && cvModal.open) {
        cvModal.close();
      } else {
        cvModal.removeAttribute("open");
      }
      cvModal.classList.remove("is-closing");
    }, 180);
  };

  document.querySelector("#downloadCvButton").addEventListener("click", openCvModal);
  cvClose.addEventListener("click", closeCvModal);
  cvModal.addEventListener("click", (event) => {
    if (event.target === cvModal) closeCvModal();
  });
  cvChoices.addEventListener("click", () => closeCvModal());

  const primaryLinks = document.querySelector("#primaryLinks");
  data.links.forEach((item) => {
    primaryLinks.appendChild(makeLink(item, `link-button${item.primary ? " primary" : ""}`));
  });

  const quickFacts = document.querySelector("#quickFacts");
  data.quickFacts.forEach((fact) => {
    const wrapper = document.createElement("div");
    wrapper.appendChild(makeElement("dt", "", fact.label));
    wrapper.appendChild(makeElement("dd", "", fact.value));
    quickFacts.appendChild(wrapper);
  });

  const experienceList = document.querySelector("#experienceList");
  data.experience.forEach((job) => {
    const article = makeElement("article", "timeline-item");
    const top = makeElement("div", "item-top");
    const titleGroup = makeElement("div");
    titleGroup.appendChild(makeElement("h3", "", job.title));
    titleGroup.appendChild(makeElement("p", "meta", job.company));
    top.appendChild(titleGroup);
    top.appendChild(makeElement("p", "dates", job.dates));
    article.appendChild(top);

    const list = makeElement("ul", "bullet-list");
    job.bullets.forEach((bullet) => list.appendChild(makeElement("li", "", bullet)));
    article.appendChild(list);
    experienceList.appendChild(article);
  });

  const pdfModal = makeElement("dialog", "pdf-modal");
  const pdfPanel = makeElement("div", "pdf-modal-panel");
  const pdfBar = makeElement("div", "pdf-modal-bar");
  const pdfTitle = makeElement("p", "", "Project PDF");
  const pdfControls = makeElement("div", "pdf-modal-controls");
  const pdfPrev = makeElement("button", "pdf-page-button", "Prev");
  const pdfPage = makeElement("span", "pdf-page-count", "1 / 1");
  const pdfNext = makeElement("button", "pdf-page-button", "Next");
  const pdfClose = makeElement("button", "pdf-modal-close", "Close");
  const pdfCanvasShell = makeElement("div", "pdf-canvas-shell");
  const pdfImage = document.createElement("img");
  const pdfSourceLink = makeElement("a", "pdf-source-link", "Open PDF");
  let currentPdfProject;
  let currentPdfPage = 1;

  [pdfPrev, pdfNext, pdfClose].forEach((button) => {
    button.type = "button";
    button.addEventListener("mousedown", (event) => event.preventDefault());
  });
  pdfClose.setAttribute("aria-label", "Close PDF preview");
  pdfImage.alt = "";
  pdfImage.decoding = "async";
  pdfSourceLink.target = "_blank";
  pdfSourceLink.rel = "noreferrer";
  pdfControls.appendChild(pdfPrev);
  pdfControls.appendChild(pdfPage);
  pdfControls.appendChild(pdfNext);
  pdfControls.appendChild(pdfSourceLink);
  pdfBar.appendChild(pdfTitle);
  pdfBar.appendChild(pdfControls);
  pdfBar.appendChild(pdfClose);
  pdfCanvasShell.appendChild(pdfImage);
  pdfPanel.appendChild(pdfBar);
  pdfPanel.appendChild(pdfCanvasShell);
  pdfModal.appendChild(pdfPanel);
  document.body.appendChild(pdfModal);

  const getPdfPageImage = (project, pageNumber) => {
    const page = String(pageNumber).padStart(2, "0");
    return project.document.pagePattern.replace("{page}", page);
  };

  const updatePdfControls = () => {
    const total = currentPdfProject?.document.pageCount || 1;
    pdfPage.textContent = `${currentPdfPage} / ${total}`;
    pdfPrev.disabled = currentPdfPage <= 1;
    pdfNext.disabled = currentPdfPage >= total;
  };

  const renderPdfPage = (pageNumber) => {
    if (!currentPdfProject) return;
    const total = currentPdfProject.document.pageCount || 1;
    currentPdfPage = Math.min(Math.max(pageNumber, 1), total);
    pdfImage.src = getPdfPageImage(currentPdfProject, currentPdfPage);
    updatePdfControls();
  };

  const closePdf = () => {
    if (!pdfModal.open) return;
    pdfModal.classList.remove("is-open");
    pdfModal.classList.add("is-closing");
    window.setTimeout(() => {
      currentPdfProject = null;
      pdfImage.removeAttribute("src");
      if (typeof pdfModal.close === "function" && pdfModal.open) {
        pdfModal.close();
      } else {
        pdfModal.removeAttribute("open");
      }
      pdfModal.classList.remove("is-closing");
    }, 200);
  };

  const openPdf = (project) => {
    pdfModal.classList.remove("is-open", "is-closing");
    currentPdfProject = project;
    currentPdfPage = 1;
    pdfTitle.textContent = project.title;
    pdfSourceLink.href = project.document.href;
    renderPdfPage(1);
    if (typeof pdfModal.showModal === "function") {
      pdfModal.showModal();
    } else {
      pdfModal.setAttribute("open", "");
    }
    requestAnimationFrame(() => {
      pdfModal.classList.add("is-open");
    });
  };

  pdfPrev.addEventListener("click", () => renderPdfPage(currentPdfPage - 1));
  pdfNext.addEventListener("click", () => renderPdfPage(currentPdfPage + 1));
  pdfClose.addEventListener("click", closePdf);
  pdfModal.addEventListener("click", (event) => {
    if (event.target === pdfModal) closePdf();
  });
  pdfModal.addEventListener("close", () => {
    pdfModal.classList.remove("is-open", "is-closing");
    currentPdfProject = null;
    pdfImage.removeAttribute("src");
  });
  pdfModal.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") renderPdfPage(currentPdfPage - 1);
    if (event.key === "ArrowRight") renderPdfPage(currentPdfPage + 1);
  });
  const projectList = document.querySelector("#projectList");
  data.projects.forEach((project) => {
    const article = makeElement("article", `project-card${project.document ? " project-card--document" : ""}${project.image ? " project-card--image" : ""}`);
    const content = makeElement("div", "project-content");
    content.appendChild(makeElement("h3", "", project.title));
    content.appendChild(makeElement("p", "", project.description));
    const tags = makeElement("div", "tag-row");
    project.tags.forEach((tag) => tags.appendChild(makeElement("span", "tag", tag)));
    content.appendChild(tags);
    article.appendChild(content);

    if (project.action) {
      const action = document.createElement("a");
      const icon = makeElement("span", "project-side-action-icon", "GH");
      const label = makeElement("span", "project-side-action-label", project.action.label);

      action.className = "project-side-action";
      action.href = project.action.href;
      action.target = "_blank";
      action.rel = "noreferrer";
      action.setAttribute("aria-label", `Open ${project.action.label} repository`);
      action.appendChild(icon);
      action.appendChild(label);
      article.appendChild(action);
    }

    if (project.document) {
      const preview = makeElement("button", "project-preview");
      const image = document.createElement("img");
      const tag = makeElement("span", "project-preview-tag", project.document.label);
      const prompt = makeElement("span", "project-preview-prompt", "View");

      preview.type = "button";
      preview.setAttribute("aria-label", `View ${project.title} PDF`);
      image.src = project.document.preview;
      image.alt = "";
      preview.appendChild(image);
      preview.appendChild(tag);
      preview.appendChild(prompt);
      preview.addEventListener("click", () => openPdf(project));
      article.appendChild(preview);
    } else if (project.image) {
      const preview = makeElement("div", "project-preview project-preview--static");
      const image = document.createElement("img");
      const tag = makeElement("span", "project-preview-tag", project.image.label);

      image.src = project.image.src;
      image.alt = "";
      preview.appendChild(image);
      preview.appendChild(tag);
      article.appendChild(preview);

      article.addEventListener("pointermove", (event) => {
        const rect = article.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        article.style.setProperty("--preview-pan-x", `${x * -18}%`);
        article.style.setProperty("--preview-pan-y", `${y * -10}%`);
      });
      article.addEventListener("pointerleave", () => {
        article.style.setProperty("--preview-pan-x", "0%");
        article.style.setProperty("--preview-pan-y", "0%");
      });
    }

    projectList.appendChild(article);
  });

  const skillList = document.querySelector("#skillList");
  data.skills.forEach((skill) => {
    const group = makeElement("section", "skill-group");
    group.appendChild(makeElement("h3", "", skill.group));
    const list = makeElement("ul");
    skill.items.forEach((item) => list.appendChild(makeElement("li", "tag", item)));
    group.appendChild(list);
    skillList.appendChild(group);
  });

  const educationList = document.querySelector("#educationList");
  data.education.forEach((education) => {
    const article = makeElement("article", "education-item");
    const top = makeElement("div", "item-top");
    const titleGroup = makeElement("div");
    titleGroup.appendChild(makeElement("h3", "", education.school));
    titleGroup.appendChild(makeElement("p", "meta", education.credential));
    top.appendChild(titleGroup);
    top.appendChild(makeElement("p", "dates", education.dates));
    article.appendChild(top);
    article.appendChild(makeElement("p", "", education.details));
    educationList.appendChild(article);
  });

  const contactList = document.querySelector("#contactList");
  data.contact.forEach((contact) => {
    const item = document.createElement("li");
    item.appendChild(makeLink(contact, ""));
    contactList.appendChild(item);
  });

  const hero = document.querySelector(".hero");
  const setWordmarkVisibility = () => {
    const heroHeight = hero ? hero.offsetHeight : window.innerHeight;
    root.classList.toggle("show-wordmark", window.scrollY > heroHeight * 0.82);
  };

  setWordmarkVisibility();
  window.addEventListener("scroll", setWordmarkVisibility, { passive: true });
  window.addEventListener("resize", setWordmarkVisibility);

  document.querySelector("#themeToggle").addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "" : "dark";
    if (nextTheme) {
      root.dataset.theme = nextTheme;
      localStorage.setItem("resume-theme", nextTheme);
    } else {
      delete root.dataset.theme;
      localStorage.removeItem("resume-theme");
    }
  });

})();
