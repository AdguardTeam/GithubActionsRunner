import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const commonPlugins = [
    json(),
    resolve({
        preferBuiltins: true,
    }),
    commonjs(),
    typescript(),
];

const bin = {
    input: 'src/cli/index.ts',
    output: [
        {
            dir: 'dist/bin',
            format: 'cjs',
        },
    ],
    plugins: [
        ...commonPlugins,
    ],
};

const api = {
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'cjs',
        },
        {
            dir: 'dist/es',
            format: 'es',
            entryFileNames: '[name].mjs',
        },
    ],
    plugins: [
        ...commonPlugins,
    ],
};

export default [bin, api];
