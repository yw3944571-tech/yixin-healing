// =========================
// 奕心疗愈舍 V1.0
// 前端交互逻辑
// =========================


// Toast 提示
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

let toastTimer = null;

function showToast(message) {
  if (!toast || !toastText) return;

  toastText.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


// 当前选择的服务
let selectedService = "";


// =========================
// 立即预约
// =========================

function startBooking(serviceName = "") {
  selectedService = serviceName;

  if (selectedService) {
    showToast(`已选择：${selectedService}`);
  } else {
    showToast("请选择一项疗愈服务");
  }

  // 暂时滚动到推荐服务区域
  const serviceSection = document.querySelector(".service-section");

  if (serviceSection) {
    setTimeout(() => {
      serviceSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 300);
  }
}


// 首页立即预约
const startBookingBtn = document.getElementById("startBookingBtn");

if (startBookingBtn) {
  startBookingBtn.addEventListener("click", () => {
    startBooking();
  });
}


// =========================
// 服务项目预约
// =========================

const bookButtons = document.querySelectorAll(".book-btn");

bookButtons.forEach((button) => {

  button.addEventListener("click", () => {

    const serviceName = button.dataset.service;

    startBooking(serviceName);

  });

});


// =========================
// 查看疗愈师
// =========================

const viewTherapistsBtn =
  document.getElementById("viewTherapistsBtn");

if (viewTherapistsBtn) {

  viewTherapistsBtn.addEventListener("click", () => {

    const therapistSection =
      document.querySelector(".therapist-section");

    if (therapistSection) {

      therapistSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    }

  });

}


// =========================
// 底部导航
// =========================

const navItems =
  document.querySelectorAll(".nav-item");

navItems.forEach((item) => {

  item.addEventListener("click", () => {

    // 清除当前选中状态
    navItems.forEach((nav) => {
      nav.classList.remove("active");
    });

    // 当前按钮选中
    item.classList.add("active");

    const page =
      item.dataset.page;

    // 首页
    if (page === "home") {

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      showToast("已回到首页");
    }


    // 疗愈师
    if (page === "therapists") {

      const therapistSection =
        document.querySelector(".therapist-section");

      if (therapistSection) {

        therapistSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      }

      showToast("查看推荐疗愈师");
    }


    // 预约
    if (page === "booking") {

      startBooking();

    }


    // 订单
    if (page === "orders") {

      showToast("订单功能即将上线");

    }


    // 我的
    if (page === "profile") {

      showToast("个人中心即将上线");

    }

  });

});


// =========================
// 城市按钮
// =========================

const cityBtn =
  document.querySelector(".city-btn");

if (cityBtn) {

  cityBtn.addEventListener("click", () => {

    showToast("当前服务城市：重庆");

  });

}


// =========================
// 查看全部服务
// =========================

const moreButtons =
  document.querySelectorAll(".more-btn");

moreButtons.forEach((button) => {

  if (button.id === "viewTherapistsBtn") {
    return;
  }

  button.addEventListener("click", () => {

    showToast("更多疗愈服务正在规划中");

  });

});


// =========================
// 页面加载完成
// =========================

document.addEventListener("DOMContentLoaded", () => {

  console.log("奕心疗愈舍 V1.0 已启动");

});
