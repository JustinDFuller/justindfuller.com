import globals from "globals";

export default [
    {
        ignores: [
            'node_modules',
            '.appengine',
            '.build',
            '.devcontainer',
            '.github',
            '.routes',
            'main.js'
        ]
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.worker,
            },
        },
    }
];