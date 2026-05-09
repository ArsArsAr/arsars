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

  const projectList = document.querySelector("#projectList");
  data.projects.forEach((project) => {
    const article = makeElement("article", "project-card");
    article.appendChild(makeElement("h3", "", project.title));
    article.appendChild(makeElement("p", "", project.description));
    const tags = makeElement("div", "tag-row");
    project.tags.forEach((tag) => tags.appendChild(makeElement("span", "tag", tag)));
    article.appendChild(tags);
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
