import React from 'react';
// FIX: Import Action type to correctly type the history array.
import { Role, User, Case, CRMStatus, SubStatus, ActionType, Debtor, Loan, NavItem, Action } from './types';

export const ICONS = {
    // FIX: Converted JSX to React.createElement to be compatible with .ts files.
    dashboard: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }), React.createElement("polyline", { points: "9 22 9 12 15 12 15 22" })),
    case: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }), React.createElement("line", { x1: "3", y1: "9", x2: "21", y2: "9" }), React.createElement("line", { x1: "9", y1: "21", x2: "9", y2: "9" })),
    team: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), React.createElement("circle", { cx: "9", cy: "7", r: "4" }), React.createElement("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }), React.createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })),
    archive: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("polyline", { points: "21 8 21 21 3 21 3 8" }), React.createElement("rect", { x: "1", y: "3", width: "22", height: "5" }), React.createElement("line", { x1: "10", y1: "12", x2: "14", y2: "12" })),
    documentReport: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), React.createElement("polyline", { points: "14 2 14 8 20 8" }), React.createElement("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), React.createElement("line", { x1: "16", y1: "17", x2: "8", y2: "17" }), React.createElement("polyline", { points: "10 9 9 9 8 9" })),
    reports: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M21.21 15.89A10 10 0 1 1 8 2.83" }), React.createElement("path", { d: "M22 12A10 10 0 0 0 12 2v10z" })),
    payment: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("rect", { x: "1", y: "4", width: "22", height: "16", rx: "2", ry: "2" }), React.createElement("line", { x1: "1", y1: "10", x2: "23", y2: "10" })),
    user: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), React.createElement("circle", { cx: "12", cy: "7", r: "4" })),
    activities: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })),
    
    logout: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" })),
    money: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" })),
    performance: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" })),
    phone: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" })),
    email: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" })),
    legal: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" })),
    calendar: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18M-4.5 12h22.5" })),
    interaction: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.455.09-.934.09-1.425 0-4.556 4.03-8.25 9-8.25 4.97 0 9 3.694 9 8.25Z" })),
    clients: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.962 3.996 3.996m0 0A3.75 3.75 0 0 1 12 19.5h-1.5a3.75 3.75 0 0 1-3.75-3.75V14.25m6 3.75-3.996-3.996M12 12.75a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" })),
    general: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" })),
    close: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" })),
    filter: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: "1.5", stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" })),
    lightbulb: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.311a7.5 7.5 0 0 1-7.5 0c-1.42 0-2.8 1.42-3.8 2.311M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.311a7.5 7.5 0 0 1-7.5 0c-1.42 0-2.8 1.42-3.8 2.311M12 3v1.875m0 0a6.01 6.01 0 0 1-1.5.189m1.5-.189a6.01 6.01 0 0 0 1.5.189M12 3v1.875m-3.75 2.311a7.5 7.5 0 0 1 7.5 0 7.5 7.5 0 0 1-7.5 0ZM12 3v1.875m0 0a6.01 6.01 0 0 1-1.5.189m1.5-.189a6.01 6.01 0 0 0 1.5.189" })),
    reactivate: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.664 0l3.181-3.183m-4.991-2.691V5.25a3.375 3.375 0 0 0-3.375-3.375h-1.5a3.375 3.375 0 0 0-3.375 3.375v4.992m-4.993 0h4.992" })),
    upload: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" })),
    download: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" })),
    info: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className:className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"})),
    // FIX: Add missing danger icon used in CaseDetailView.
    danger: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" })),
    export: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className:className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"M9 17.25v-2.25m3 2.25v-2.25m3 2.25v-2.25M3 17.25v2.25a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 19.5V17.25M3 13.5v-2.25a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 11.25V13.5m-18 0h18M12 15a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm-4.5-3a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm9 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"})),
    search: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" })),
    chevronDown: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className:className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"m19.5 8.25-7.5 7.5-7.5-7.5"})),
    chevronUp: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className:className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"m4.5 15.75 7.5-7.5 7.5 7.5"})),
    // FIX: Added missing arrow icon for back button
    arrow: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" })),
    eye: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2.036 12.322a1.012 1.012 0 0 1 0-.639l4.436-7.382a1.012 1.012 0 0 1 1.736 0l4.436 7.382a1.012 1.012 0 0 1 0 .639l-4.436 7.382a1.012 1.012 0 0 1-1.736 0l-4.436-7.382Z" }), React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" })),
    eyeOff: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" })),
    plus: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"M12 4.5v15m7.5-7.5h-15"})),

    // Vision UI Icons
    wallet: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "currentColor", strokeWidth: "0", viewBox: "0 0 24 24", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M21 4H3C1.895 4 1 4.895 1 6V18C1 19.105 1.895 20 3 20H21C22.105 20 23 19.105 23 18V6C23 4.895 22.105 4 21 4ZM21 18H3V6H21V18Z" }), React.createElement("path", { d: "M20 9H16C15.448 9 15 9.448 15 10V14C15 14.552 15.448 15 16 15H20C20.552 15 21 14.552 21 14V10C21 9.448 20.552 9 20 9Z" })),
    globe: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "currentColor", strokeWidth: "0", viewBox: "0 0 1024 1024", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372zm0-444c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64zm-144 0c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64zm288 0c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64z" })),
    cart: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "currentColor", strokeWidth: "0", viewBox: "0 0 24 24", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M21.822 7.431A1 1 0 0 0 21 7H7.333L6.179 4.23A1.994 1.994 0 0 0 4.333 3H2v2h2.333l4.744 11.385A1 1 0 0 0 10 17h8c.417 0 .79-.259.937-.648l3-8a1 1 0 0 0-.115-.921zM17.307 15h-6.64l-2.5-6h11.39l-2.25 6z" }), React.createElement("circle", { cx: "10.5", cy: "19.5", r: "1.5" }), React.createElement("circle", { cx: "17.5", cy: "19.5", r: "1.5" })),
    help: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "currentColor", strokeWidth: "0", viewBox: "0 0 16 16", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" }), React.createElement("path", { d: "M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" })),
    settings: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "currentColor", strokeWidth: "0", viewBox: "0 0 24 24", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("path", { d: "M12 14c-1.103 0-2 .897-2 2s.897 2 2 2 2-.897 2-2-.897-2-2-2zM12 4c-1.103 0-2 .897-2 2s.897 2 2 2 2-.897 2-2-.897-2-2-2zM12 9c-1.103 0-2 .897-2 2s.897 2 2 2 2-.897 2-2-.897-2-2-2z" })),
    // FIX: Add missing success icon used in CaseDetailView.
    success: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" })),
    bell: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"})),
    edit: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"})),
    trash: (className: string) => React.createElement("svg", { xmlns:"http://www.w3.org/2000/svg", className, fill:"none", viewBox:"0 0 24 24", strokeWidth:1.5, stroke:"currentColor"}, React.createElement("path", { strokeLinecap:"round", strokeLinejoin:"round", d:"m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 4.811 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"})),
    sun: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" })),
    moon: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25c0 5.385 4.365 9.75 9.75 9.75 2.572 0 4.92-.99 6.697-2.648Z" })),
    menu: (className: string) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: className, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor" }, React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" })),
    // FIX: Add aliases for icons used in dashboards
    get activeCases() { return this.case as any },
    get totalCases() { return this.case as any },
    get recovered() { return this.money as any },
    get recoveryRate() { return this.performance as any },
    // FIX: Add 'avgDpd' alias for calendar icon to fix missing property error on dashboards.
    get avgDpd() { return this.calendar as any; },
    bolt: (className: string) => React.createElement("svg", { className, stroke: "currentColor", fill: "none", strokeWidth: "2", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round", height: "1em", width: "1em", xmlns: "http://www.w3.org/2000/svg" }, React.createElement("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })),
};

export const STATUS_MAP: Record<CRMStatus, SubStatus[]> = {
    [CRMStatus.CB]: [SubStatus.RNR, SubStatus.ANSM, SubStatus.CB_MAIL, SubStatus.IN_UAE, SubStatus.MAIL_REPLY, SubStatus.MAIL_RETURN, SubStatus.MAIL_SENT, SubStatus.MNSO, SubStatus.MOL_A, SubStatus.MOL_I, SubStatus.OUT_UAE, SubStatus.SMSD, SubStatus.SMSND, SubStatus.TPC, SubStatus.UN, SubStatus.VMAIL, SubStatus.OUT_UAE_PAKISTAN, SubStatus.THIRD_PARTY_CONTACT, SubStatus.MOL_ACTIVE, SubStatus.MAIL_DELIVERED],
    [CRMStatus.NCC]: [SubStatus.NOT_CONTACTABLE],
    [CRMStatus.FIP]: [SubStatus.FINANCIAL_ISSUES],
    [CRMStatus.NITP]: [SubStatus.NOT_INTERESTED_TO_PAY],
    [CRMStatus.UTR]: [SubStatus.UNDER_TRACING],
    [CRMStatus.DXB]: [SubStatus.CASE_BILKISH_HANDLE],
    [CRMStatus.UNDER_NEGO]: [SubStatus.FOLLOW_UP, SubStatus.UNDER_NEGOTIATION],
    [CRMStatus.DISPUTE]: [SubStatus.REFUSE_OR_SETTLE],
    [CRMStatus.PTP]: [SubStatus.PROMISE_TO_PAY, SubStatus.PAID, SubStatus.FOLLOW_UP],
    [CRMStatus.WIP]: [SubStatus.WORK_IN_PROCESS],
    [CRMStatus.EXPIRE]: [SubStatus.DC_DEATH_CERTIFICATE],
    [CRMStatus.WDS]: [SubStatus.WITHDRAWAL_STATUS],
    [CRMStatus.NIP]: [SubStatus.NOT_IN_PORTAL],
    [CRMStatus.CLOSED]: [SubStatus.PAID_CLOSED, SubStatus.PAID],
    [CRMStatus.WITHDRAWN]: [SubStatus.BANK_RECALL, SubStatus.PAID_AND_WITHDRAWN, SubStatus.NOT_IN_PORTAL, SubStatus.ARCHIVED_BANK_RECALL, SubStatus.ARCHIVED_PAID_AND_WITHDRAWN],
    [CRMStatus.RTP]: [SubStatus.REFUSE_TO_PAY],
    [CRMStatus.NEW]: [SubStatus.NONE],
    [CRMStatus.HOLD]: [SubStatus.NONE],
};

export const UNASSIGNED_USER: User = { id: 'unassigned-user-id', name: 'Unassigned', role: Role.OFFICER };

// Demo mode credentials are validated in AuthContext — not stored in plain text here
export const USERS: User[] = [
  UNASSIGNED_USER,
  { id: 'user-0', name: 'Admin User', role: Role.ADMIN },
  { id: 'user-ceo', name: 'CEO User', role: Role.CEO },
  { id: 'user-1', name: 'Samantha Jones', role: Role.MANAGER },
  { id: 'user-finance', name: 'Accountant User', role: Role.FINANCE },
  { id: 'user-3', name: 'Maria Garcia', role: Role.OFFICER, agentCode: 'MG', target: 150000, dailyTarget: 5000 },
  { id: 'user-4', name: 'John Smith', role: Role.OFFICER, agentCode: 'JS', target: 150000, dailyTarget: 5000 },
  { id: 'user-5', name: 'Emily White', role: Role.OFFICER, agentCode: 'EW', target: 150000, dailyTarget: 5000 },
  { id: 'user-6', name: 'Michael Brown', role: Role.OFFICER, agentCode: 'MB', target: 150000, dailyTarget: 5000 },
  { id: 'user-7', name: 'Jessica Lee', role: Role.OFFICER, agentCode: 'JL', target: 150000, dailyTarget: 5000 },
];

export const COORDINATORS: User[] = USERS.filter(u => u.role === Role.OFFICER);


// --- DATA GENERATION ---
let generatedDebtors: Debtor[] = [];
let generatedLoans: Loan[] = [];
let generatedCases: Case[] = [];

const productTypes = ['Personal Loan', 'Auto Loan', 'Credit Card', 'Mortgage'];
const subProductTypes = ['VISA CARD', 'MASTER CARD', 'PL', 'SME', 'OD'];
export const banks = [
    'ABK', 'ADIB', 'AL-RAJHI', 'ALAB', 'ALAMANA', 'ALGHANIM', 'ALSALAM-BAH', 'AMEX-BAH', 
    'AMEX-QAR', 'AMLAK', 'BURGAN', 'CREDI', 'DIB', 'DUKHAN', 'EIB', 'FAB', 'FLOOSS', 'GBK', 
    'GF', 'KFH-BAH', 'KFH-KWT', 'MASH', 'MASH-QAR', 'MUSCAT', 'NBF', 'NBK', 'NBO', 'NBUQ', 
    'NFO', 'QNB', 'RAK', 'RIYAD', 'SAB', 'SIB', 'SNB'
];
const bankCurrencyMap: Record<string, 'AED' | 'SAR' | 'BHD' | 'KWD'> = {
    'ALAB': 'AED', 'DIB': 'AED', 'ADIB': 'AED', 'ABK': 'AED', 'ALAMANA': 'AED', 'AMLAK': 'AED', 'EIB': 'AED', 'FAB': 'AED', 'MASH': 'AED', 'NBF': 'AED', 'RAK': 'AED', 'SIB': 'AED', 'FLOOSS': 'AED', 'NFO': 'AED',
    'SAB': 'SAR', 'SNB': 'SAR', 'AL-RAJHI': 'SAR', 'RIYAD': 'SAR',
    'ALSALAM-BAH': 'BHD', 'AMEX-BAH': 'BHD', 'CREDI': 'BHD', 'KFH-BAH': 'BHD', 'GF': 'BHD',
    'ALGHANIM': 'KWD', 'BURGAN': 'KWD', 'GBK': 'KWD', 'KFH-KWT': 'KWD', 'NBK': 'KWD',
};

const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'SHAH', 'SAMI', 'MUHAMMAD', 'RIZWAN', 'SYED', 'IMRAN', 'FURQAN', 'ALLEN', 'TABISH', 'WASEEM', 'SALAH', 'FAZAL', 'NAUMAN', 'ABDULKHALIQ', 'GHOZIR'];
const lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'SHEHRYAR', 'MOHAMMAD', 'MUBIN', 'KHAN', 'NAZIR', 'WAHAB', 'IQBAL', 'ATIQ', 'SAQIB', 'ALI', 'AZAM'];
const crmStatuses = Object.values(CRMStatus);
const statusCodes = ['NEW', 'CB', 'FRESHCASE', 'RE-ASSIGN', 'Inactive to Active', 'UNASSIGNED'];

let caseCounter = 1;

const createCase = (officer: User | null, bank: string | null) => {
    const debtorId = `debtor-gen-${caseCounter}`;
    const loanId = `loan-gen-${caseCounter}`;
    const caseId = `case-gen-${caseCounter}`;
    const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const assignedCoordinator = officer || UNASSIGNED_USER;

    const newDebtor: Debtor = {
        id: debtorId,
        name: `${randomFirstName} ${randomLastName}`,
        emails: [`user${caseCounter}@example.com`],
        phones: [`97150${String(Math.floor(Math.random()*9000000)+1000000)}`],
        address: `${caseCounter} Generated St, Codeville, USA`,
        passport: `P${Math.floor(Math.random() * 900000) + 100000}`,
        cnic: `${Math.floor(Math.random() * 90000)}-${Math.floor(Math.random() * 9000000)}-${Math.floor(Math.random()*9)}`,
        eid: `EID${Math.floor(Math.random() * 90000000) + 10000000}`,
        dob: new Date(Date.now() - (18 + Math.floor(Math.random() * 50)) * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tracingHistory: [],
    };
    
    if (Math.random() > 0.8) {
        newDebtor.tracingHistory.push({
            timestamp: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString(),
            note: 'Found potential new employer through online search: "Global Innovations Inc."',
            officerId: assignedCoordinator.id,
        });
    }


    generatedDebtors.push(newDebtor);

    if (Math.random() > 0.5) {
        newDebtor.emails.push(`alt.${randomLastName.toLowerCase()}${caseCounter}@example.com`);
    }
    if (Math.random() > 0.3) {
        newDebtor.phones.push(`97155${String(Math.floor(Math.random()*9000000)+1000000)}`);
    }
     if (Math.random() > 0.8) {
        newDebtor.phones.push(`97152${String(Math.floor(Math.random()*9000000)+1000000)}`);
    }


    const originalAmount = Math.floor(Math.random() * 45000) + 5000;
    const currentBalance = Math.floor(Math.random() * originalAmount);
    const selectedBank = bank || banks[Math.floor(Math.random() * banks.length)];
    const lpdDate = new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000));

    generatedLoans.push({
        id: loanId,
        debtorId: debtorId,
        accountNumber: `MA${Math.floor(Math.random() * 900000)}`,
        originalAmount: originalAmount,
        currentBalance: currentBalance,
        product: productTypes[Math.floor(Math.random() * productTypes.length)],
        bank: selectedBank,
        currency: bankCurrencyMap[selectedBank] || 'AED',
        subProduct: subProductTypes[Math.floor(Math.random() * subProductTypes.length)],
        bucket: `Recovery`,
        lpd: lpdDate.toISOString().split('T')[0],
        wod: Math.random() > 0.95 ? new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] : undefined,
        cif: `CIF${Math.floor(Math.random() * 900000) + 100000}`,
    });
    
    let statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];
    if (!officer) {
        statusCode = 'UNASSIGNED';
    }

    const creationDate = new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000);
    
    const crmStatus = crmStatuses[Math.floor(Math.random() * crmStatuses.length)];
    const possibleSubStatuses = STATUS_MAP[crmStatus] || [];
    const subStatus = possibleSubStatuses.length > 0 
        ? possibleSubStatuses[Math.floor(Math.random() * possibleSubStatuses.length)] 
        : SubStatus.NONE;
    
    const actionDate = new Date(creationDate.getTime() + Math.random() * (new Date().getTime() - creationDate.getTime()));
    const nextFollowUpDate = crmStatus !== CRMStatus.CLOSED ? new Date(Date.now() + Math.floor(Math.random() * 14 - 4) * 24 * 60 * 60 * 1000) : null;

    const history: Action[] = [{
        id: `act-gen-${caseCounter}-1`, caseId: caseId, type: ActionType.SOFT_CALL,
        timestamp: actionDate.toISOString(), officerId: assignedCoordinator.id, notes: 'Initial contact attempt made.',
        nextFollowUp: nextFollowUpDate ? nextFollowUpDate.toISOString() : null,
    }];

    generatedCases.push({
        id: caseId, debtorId: debtorId, loanId: loanId, assignedOfficerId: assignedCoordinator.id,
        crmStatus: crmStatus, subStatus: subStatus, creationDate: creationDate.toISOString(),
        lastContactDate: actionDate.toISOString(), contactStatus: Math.random() > 0.5 ? 'Contact' : 'Non Contact',
        workStatus: Math.random() > 0.3 ? 'Work' : 'Non Work', tracingStatus: Math.random() > 0.8 ? 'Pending Tracing' : 'Tracing Not Avail',
        statusCode: statusCode, cyber: Math.random() > 0.5 ? 'Yes' : 'No', history: history,
        auditLog: [{
            id: `log-gen-${caseCounter}-1`, caseId: caseId, timestamp: creationDate.toISOString(),
            userId: 'user-1', details: `Case assigned to ${assignedCoordinator.name}.`,
        }],
    });

    caseCounter++;
}

// Generate exactly 3 cases for each bank
const assignableCoordinators = COORDINATORS.filter(c => c.id !== UNASSIGNED_USER.id);
let coordinatorIndex = 0;
for (const bank of banks) {
    for (let i = 0; i < 3; i++) {
        const officer = assignableCoordinators.length > 0 ? assignableCoordinators[coordinatorIndex % assignableCoordinators.length] : UNASSIGNED_USER;
        createCase(officer, bank);
        coordinatorIndex++;
    }
}


export let DEBTORS: Debtor[] = generatedDebtors;
export let LOANS: Loan[] = generatedLoans;
export let CASES: Case[] = generatedCases;

// --- END DATA GENERATION ---


export const WORKFLOW_STEPS = [
    ActionType.SOFT_CALL,
    ActionType.EMAIL_NOTICE,
    ActionType.LEGAL_ASSESSMENT,
    ActionType.PAYMENT_PLAN_AGREED,
    ActionType.PAYMENT_RECEIVED,
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
    // ═══ OFFICER: Clean, minimal — only what they need daily ═══
    { label: 'Dashboard', view: 'dashboard-officer', icon: ICONS.dashboard, roles: [Role.OFFICER] },
    { label: 'Work Queue', view: 'work-queue', icon: ICONS.bolt, roles: [Role.OFFICER] },
    { label: 'My Cases', view: 'cases', icon: ICONS.case, roles: [Role.OFFICER] },
    { label: 'My Tasks', view: 'productivity', icon: ICONS.activities, roles: [Role.OFFICER] },
    { label: 'Liability Emails', view: 'liability-emails', icon: ICONS.payment, roles: [Role.OFFICER] },
    { label: 'Attendance', view: 'attendance-portal', icon: ICONS.calendar, roles: [Role.OFFICER] },
    { label: 'Tracing Tools', view: 'tracing-tools', icon: ICONS.search, roles: [Role.OFFICER] },
    { label: 'Day-End Report', view: 'daily-report', icon: ICONS.documentReport, roles: [Role.OFFICER] },

    // ═══ MANAGER: Operations focused ═══
    { label: 'Dashboard', view: 'dashboard-manager', icon: ICONS.dashboard, roles: [Role.MANAGER] },
    { label: 'Cases', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'All Cases', view: 'cases', icon: ICONS.case, roles: [Role.MANAGER] },
    { label: 'Pipeline Board', view: 'kanban', icon: ICONS.filter, roles: [Role.MANAGER] },
    { label: 'Team Allocation', view: 'team', icon: ICONS.team, roles: [Role.MANAGER] },
    { label: 'Pending Withdrawals', view: 'pending-withdrawals', icon: ICONS.archive, roles: [Role.MANAGER] },
    { label: 'Bank Drafts', view: 'bank-drafts', icon: ICONS.payment, roles: [Role.MANAGER] },
    { label: 'Reports', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'Summary Report', view: 'summary-report', icon: ICONS.performance, roles: [Role.MANAGER] },
    { label: 'Day-End Report', view: 'daily-report', icon: ICONS.documentReport, roles: [Role.MANAGER] },
    { label: 'Promise Dashboard', view: 'promise-dashboard', icon: ICONS.calendar, roles: [Role.MANAGER] },
    { label: 'Analytics', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'AI Insights', view: 'ai-insights', icon: ICONS.performance, roles: [Role.MANAGER] },
    { label: 'Portfolio Intelligence', view: 'portfolio-intelligence', icon: ICONS.filter, roles: [Role.MANAGER] },
    { label: 'Team Leaderboard', view: 'productivity', icon: ICONS.performance, roles: [Role.MANAGER] },
    { label: 'People', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'HR Dashboard', view: 'hr-dashboard', icon: ICONS.user, roles: [Role.MANAGER] },
    { label: 'Notification Center', view: 'notification-center', icon: ICONS.bell, roles: [Role.MANAGER] },
    { label: 'Reports', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'Custom Reports', view: 'custom-reports', icon: ICONS.documentReport, roles: [Role.MANAGER] },
    { label: 'Debtor Portal Preview', view: 'debtor-portal', icon: ICONS.user, roles: [Role.MANAGER] },
    { label: 'Legal & Finance', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'Legal Management', view: 'legal', icon: ICONS.documentReport, roles: [Role.MANAGER] },
    { label: 'Cheque / PDC Tracker', view: 'cheque-tracker', icon: ICONS.payment, roles: [Role.MANAGER] },
    { label: 'Automation', view: '', isHeading: true, roles: [Role.MANAGER] },
    { label: 'Workflow Rules', view: 'workflow-automation', icon: ICONS.bolt, roles: [Role.MANAGER] },

    // ═══ CEO: Strategic view ═══
    { label: 'Command Center', view: 'ceo-command', icon: ICONS.dashboard, roles: [Role.CEO] },
    { label: 'Overview', view: 'dashboard-ceo', icon: ICONS.performance, roles: [Role.CEO] },
    { label: 'Intelligence', view: '', isHeading: true, roles: [Role.CEO] },
    { label: 'AI Portfolio', view: 'ai-insights', icon: ICONS.performance, roles: [Role.CEO] },
    { label: 'Recovery Forecast', view: 'ai-forecast', icon: ICONS.documentReport, roles: [Role.CEO] },
    { label: 'Portfolio Intelligence', view: 'portfolio-intelligence', icon: ICONS.filter, roles: [Role.CEO] },
    { label: 'Portfolio Aging', view: 'portfolio-aging', icon: ICONS.export, roles: [Role.CEO] },
    { label: 'Operations', view: '', isHeading: true, roles: [Role.CEO] },
    { label: 'All Cases', view: 'cases', icon: ICONS.case, roles: [Role.CEO] },
    { label: 'Pipeline Board', view: 'kanban', icon: ICONS.filter, roles: [Role.CEO] },
    { label: 'Summary Report', view: 'summary-report', icon: ICONS.performance, roles: [Role.CEO] },
    { label: 'Promise Dashboard', view: 'promise-dashboard', icon: ICONS.calendar, roles: [Role.CEO] },
    { label: 'Commission Report', view: 'commission', icon: ICONS.recovered, roles: [Role.CEO] },
    { label: 'Team Leaderboard', view: 'productivity', icon: ICONS.performance, roles: [Role.CEO] },
    { label: 'HR Dashboard', view: 'hr-dashboard', icon: ICONS.user, roles: [Role.CEO] },
    { label: 'Tools', view: '', isHeading: true, roles: [Role.CEO] },
    { label: 'Legal Management', view: 'legal', icon: ICONS.documentReport, roles: [Role.CEO] },
    { label: 'Cheque / PDC Tracker', view: 'cheque-tracker', icon: ICONS.payment, roles: [Role.CEO] },
    { label: 'Custom Reports', view: 'custom-reports', icon: ICONS.documentReport, roles: [Role.CEO] },
    { label: 'Debtor Portal Preview', view: 'debtor-portal', icon: ICONS.user, roles: [Role.CEO] },
    { label: 'Workflow Rules', view: 'workflow-automation', icon: ICONS.bolt, roles: [Role.CEO] },

    // ═══ FINANCE/ACCOUNTANT: Payments focused ═══
    { label: 'Dashboard', view: 'dashboard-accountant', icon: ICONS.dashboard, roles: [Role.FINANCE] },
    { label: 'Paid Cases', view: 'payments', icon: ICONS.payment, roles: [Role.FINANCE] },
    { label: 'Commission Verify', view: 'commission', icon: ICONS.recovered, roles: [Role.FINANCE] },
    { label: 'All Cases', view: 'cases', icon: ICONS.case, roles: [Role.FINANCE] },
];