// =========================
// 奕心疗愈舍 V1.0
// 预约系统前端逻辑
// =========================


// =========================
// Toast
// =========================

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


// =========================
// 页面元素
// =========================

const homePage = document.getElementById("homePage");
const bookingPage = document.getElementById("bookingPage");

const startBookingBtn = document.getElementById("startBookingBtn");
const bookingBackBtn = document.getElementById("bookingBackBtn");
const submitOrderBtn = document.getElementById("submitOrderBtn");


// =========================
// 预约数据
// =========================

const bookingData = {
  service: "",
  price: 0,
  duration: "",
  therapist: "",
  date: "",
  time: "",
  name: "",
  phone: "",
  address: ""
};


// =========================
// 页面切换
// =========================

function openBookingPage() {
  homePage.classList.remove("active-page");
  bookingPage.classList.add("active-page");

  window.scrollTo(0, 0);

  updateBookingSummary();
}


function goHome() {
  bookingPage.classList.remove("active-page");
  homePage.classList.add("active-page");

  window.scrollTo(0, 0);
}


// =========================
// 首页立即预约
// =========================

if (startBookingBtn) {
  startBookingBtn.addEventListener("click", () => {
    openBookingPage();
    showToast("请选择疗愈服务");
  });
}


// =========================
// 返回首页
// =========================

if (bookingBackBtn) {
  bookingBackBtn.addEventListener("click", () => {
    goHome();
  });
}


// =========================
// 首页项目预约
// =========================

const homeBookButtons = document.querySelectorAll(".book-btn");

homeBookButtons.forEach((button) => {
  button.addEventListener("click", () => {

    bookingData.service = button.dataset.service;
    bookingData.price = Number(button.dataset.price);
    bookingData.duration = button.dataset.duration;

    selectBookingServiceButton();
    openBookingPage();

    showToast(`已选择：${bookingData.service}`);
  });
});


// =========================
// 预约页面选择服务
// =========================

const serviceOptions = document.querySelectorAll(
  ".booking-service-option"
);

serviceOptions.forEach((button) => {
  button.addEventListener("click", () => {

    bookingData.service = button.dataset.service;
    bookingData.price = Number(button.dataset.price);
    bookingData.duration = button.dataset.duration;

    serviceOptions.forEach((item) => {
      item.classList.remove("selected");
    });

    button.classList.add("selected");

    updateBookingSummary();
  });
});


function selectBookingServiceButton() {

  serviceOptions.forEach((button) => {

    if (button.dataset.service === bookingData.service) {
      button.classList.add("selected");
    } else {
      button.classList.remove("selected");
    }

  });
}


// =========================
// 选择疗愈师
// =========================

const therapistOptions = document.querySelectorAll(
  ".booking-therapist-option"
);

therapistOptions.forEach((button) => {
  button.addEventListener("click", () => {

    bookingData.therapist = button.dataset.therapist;

    therapistOptions.forEach((item) => {
      item.classList.remove("selected");
    });

    button.classList.add("selected");

    updateBookingSummary();
  });
});


// =========================
// 日期
// =========================

const bookingDate = document.getElementById("bookingDate");

if (bookingDate) {

  const today = new Date().toISOString().split("T")[0];

  bookingDate.min = today;

  bookingDate.addEventListener("change", () => {

    bookingData.date = bookingDate.value;

    updateBookingSummary();
  });
}


// =========================
// 时间
// =========================

const timeOptions = document.querySelectorAll(".time-option");

timeOptions.forEach((button) => {
  button.addEventListener("click", () => {

    bookingData.time = button.dataset.time;

    timeOptions.forEach((item) => {
      item.classList.remove("selected");
    });

    button.classList.add("selected");

    updateBookingSummary();
  });
});


// =========================
// 联系信息
// =========================

const bookingName = document.getElementById("bookingName");
const bookingPhone = document.getElementById("bookingPhone");
const bookingAddress = document.getElementById("bookingAddress");


if (bookingName) {
  bookingName.addEventListener("input", () => {
    bookingData.name = bookingName.value.trim();
  });
}


if (bookingPhone) {
  bookingPhone.addEventListener("input", () => {
    bookingData.phone = bookingPhone.value.trim();
  });
}


if (bookingAddress) {
  bookingAddress.addEventListener("input", () => {
    bookingData.address = bookingAddress.value.trim();
  });
}


// =========================
// 更新订单确认
// =========================

function updateBookingSummary() {

  const summaryService =
    document.getElementById("summaryService");

  const summaryTherapist =
    document.getElementById("summaryTherapist");

  const summaryTime =
    document.getElementById("summaryTime");

  const summaryPrice =
    document.getElementById("summaryPrice");


  if (summaryService) {
    summaryService.textContent =
      bookingData.service
        ? `${bookingData.service} · ${bookingData.duration}`
        : "暂未选择";
  }


  if (summaryTherapist) {
    summaryTherapist.textContent =
      bookingData.therapist || "暂未选择";
  }


  if (summaryTime) {

    summaryTime.textContent =
      bookingData.date && bookingData.time
        ? `${bookingData.date} ${bookingData.time}`
        : "暂未选择";
  }


  if (summaryPrice) {
    summaryPrice.textContent =
      `¥${bookingData.price}`;
  }
}


// =========================
// 手机号验证
// =========================

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}


// =========================
// 提交真实订单
// =========================

if (submitOrderBtn) {

  submitOrderBtn.addEventListener("click", async () => {

    // 服务
    if (!bookingData.service) {
      showToast("请选择疗愈服务");
      return;
    }

    // 疗愈师
    if (!bookingData.therapist) {
      showToast("请选择疗愈师");
      return;
    }

    // 日期
    if (!bookingData.date) {
      showToast("请选择服务日期");
      return;
    }

    // 时间
    if (!bookingData.time) {
      showToast("请选择服务时间");
      return;
    }

    // 姓名
    if (!bookingData.name) {
      showToast("请输入姓名");
      return;
    }

    // 手机号
    if (!bookingData.phone) {
      showToast("请输入手机号");
      return;
    }

    if (!isValidPhone(bookingData.phone)) {
      showToast("请输入正确的手机号");
      return;
    }

    // 地址
    if (!bookingData.address) {
      showToast("请输入服务地址");
      return;
    }


    // 防止重复提交
    submitOrderBtn.disabled = true;

    const originalText = submitOrderBtn.textContent;

    submitOrderBtn.textContent = "正在提交...";


    try {

      // =====================
      // 真正发送订单到服务器
      // =====================

      const response = await fetch(
        "/api/orders",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(bookingData)
        }
      );


      const result = await response.json();


      // 服务器返回失败
      if (!response.ok || !result.success) {

        throw new Error(
          result.message || "预约提交失败"
        );

      }


      // 成功
      showToast(
        `预约成功，订单号：${result.order.id}`
      );


      console.log(
        "订单创建成功：",
        result.order
      );


      // 恢复按钮
      submitOrderBtn.disabled = false;
      submitOrderBtn.textContent = originalText;


      // 订单数据暂时保留，方便后续订单中心使用

      setTimeout(() => {

        goHome();

      }, 2200);


    } catch (error) {

      console.error(
        "提交订单失败：",
        error
      );

      showToast(
        error.message || "网络异常，请稍后重试"
      );

      submitOrderBtn.disabled = false;
      submitOrderBtn.textContent = originalText;

    }

  });

}


// =========================
// 底部导航
// =========================

const navItems = document.querySelectorAll(".nav-item");

navItems.forEach((item) => {

  item.addEventListener("click", () => {

    const page = item.dataset.page;


    if (page === "home") {

      navItems.forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      goHome();

      return;
    }


    if (page === "therapists") {

      goHome();

      setTimeout(() => {

        const therapistSection =
          document.querySelector(".therapist-section");

        therapistSection?.scrollIntoView({
          behavior: "smooth"
        });

      }, 100);

      showToast("推荐疗愈师");

      return;
    }


    if (page === "booking") {

      navItems.forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      openBookingPage();

      return;
    }


    if (page === "orders") {
      showToast("订单中心正在开发中");
      return;
    }


    if (page === "profile") {
      showToast("个人中心正在开发中");
      return;
    }

  });

});


// =========================
// 城市
// =========================

const cityBtn = document.querySelector(".city-btn");

if (cityBtn) {
  cityBtn.addEventListener("click", () => {
    showToast("当前服务城市：重庆");
  });
}


// =========================
// 查看疗愈师
// =========================

const viewTherapistsBtn =
  document.getElementById("viewTherapistsBtn");

if (viewTherapistsBtn) {

  viewTherapistsBtn.addEventListener("click", () => {

    const therapistSection =
      document.querySelector(".therapist-section");

    therapistSection?.scrollIntoView({
      behavior: "smooth"
    });

  });

}


// =========================
// 查看全部服务
// =========================

const viewServicesBtn =
  document.getElementById("viewServicesBtn");

if (viewServicesBtn) {

  viewServicesBtn.addEventListener("click", () => {

    const serviceSection =
      document.querySelector(".service-section");

    serviceSection?.scrollIntoView({
      behavior: "smooth"
    });

  });

}


// =========================
// 初始化
// =========================

document.addEventListener("DOMContentLoaded", () => {

  console.log(
    "奕心疗愈舍真实预约系统已启动"
  );

  updateBookingSummary();

});
