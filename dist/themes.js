"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const themes = {
    default: {
        glass: false,
    },
    glass: {
        glass: true,
        background: 'radial-gradient(circle, light-dark(#d2dbe5, #484f57) 0%, light-dark(#718ea7, #23384b) 100%) 0 0',
    },
    space: {
        glass: true,
        backgroundImage: '/static/assets/themes/space.jpg',
    },
    custom: {
        glass: false,
    },
};
exports.default = themes;
