# Maschine Mikro Controller Wiki

## Setup for Visual Studio Code

This Bitwig Studio Controller Script will create extensive control for Maschine Mikro and Bitwig Studio. It is written in TypeScript and thus needs to be compiled to JavaScript using a TypeScript transpiler.

First copy the BitwigControllerApi.d.ts Typescript definition file into your Folder. To make the the Typescript definition work you need to have typings installed

`npm install typings --global`

Install the Typedefinition file with:

`typings install file:BitwigControllerApi.d.ts --save --global`

You can now remove BitwigControllerApi.d.ts from your folder.
So that your code compiles to Javascript immediately after making adjustments to your typescript code. Start the Typescript compiler:

`tsc -w`

Make sure to load the lates "Bitwig Studio.ncmm2" File with Native Instruments Controller Editor.