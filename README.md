# Blood Donor BD — ফাইল কাঠামো

`index.html` এখন শুধু মূল কাঠামো ও ফিচার লোডার। প্রতিটি ফিচার `features/` ফোল্ডারে আলাদা ফাইলে আছে,
আর প্রতিটি ফাইলের ভিতরেই সেই ফিচারের HTML, CSS ও JavaScript একসাথে থাকে।

```
blood-donor-bd/
├── index.html                    মূল পেজ: হেডার, নেভবার, ফুটার, লেআউট CSS, ফিচার লোডার
└── features/
    ├── core.html                 মূল কনফিগ ও শুরুর কোড
    ├── biometric-lock.html       বায়োমেট্রিক লক (HTML + CSS + JS)
    ├── notices.html              নোটিস বার ও নোটিস সিস্টেম, কুইজ, কম্প্যাটিবিলিটি টেবিল
    ├── donors.html               ডোনার সার্চ, প্রোফাইল ছবি ক্রপ, ডোনার কার্ড
    ├── private-dm.html           প্রাইভেট মেসেজ (DM) ও গ্রুপ চ্যাট
    ├── success-stories.html      সাকসেস স্টোরি ও কমেন্ট
    ├── story-details.html        স্টোরি শেয়ার ও বিস্তারিত পেজ
    ├── location-weather.html     লাইভ লোকেশন ও আবহাওয়া
    ├── last-donation.html        শেষ রক্তদানের তারিখ ও প্রমাণ
    ├── offline-sync.html         অফলাইন ক্যাশ ও সিঙ্ক
    ├── push-notifications.html   পুশ নোটিফিকেশন
    ├── welcome-voice.html        লোড হলে ওয়েলকাম ভয়েস
    └── ambition-popup.html       ambitions.popup.html পপআপ লোডার
```

## কীভাবে কাজ করে
`index.html`-এর শেষে থাকা লোডার `features/` ফাইলগুলো ক্রমানুসারে আনে। প্রতিটি ফাইলের
`<style>` হেডে যোগ হয়, HTML মার্কআপ নির্দিষ্ট জায়গায় (`data-slot`) বসে, আর `<script>` ক্রমানুসারে চলে।

## নিয়ম
- নতুন ফিচার: `features/নতুন-নাম.html` বানান, তার ভিতরে HTML/CSS/JS লিখুন, তারপর `index.html`-এর লোডারে `FEATURES` তালিকায় নাম যোগ করুন।
- ফিচার তালিকার ক্রম গুরুত্বপূর্ণ। একটি ফিচারের কোড যদি অন্যটির ফাংশন সরাসরি ব্যবহার করে, সেটির আগে লোড হতে হবে।
- লোড হওয়ার জন্য HTTP সার্ভার লাগবে (যেমন `python3 -m http.server`)। শুধু ফাইল ডাবল-ক্লিক করে `file://`-এ খুললে `fetch` কাজ করবে না।
- `manifest.json`, `ambitions.popup.html` ও ইমেজ ফাইলগুলো এই ফোল্ডারের পাশে রাখতে হবে।
