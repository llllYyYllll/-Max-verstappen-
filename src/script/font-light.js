import gsap from "https://esm.sh/gsap";
import { ScrollTrigger } from "https://esm.sh/gsap/ScrollTrigger/";
gsap.registerPlugin(ScrollTrigger);

document.querySelectorAll(".headline").forEach((el) => {
gsap.fromTo(el, { "--gy": "140vh" }, {
            "--gy": "-40vh",
            ease: "none",
            scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
            },
        },
    );
});
