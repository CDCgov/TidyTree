export interface ColorOptions {
    colorMode: string;
    colorList: string[];
    selectedNodes?: string[]; // only needed for some colorModes
}

export interface TidyTreeOptions {
    layout: string,
    type: string,
    mode: string,
    colorOptions: ColorOptions,
    leafNodes: boolean,
    leafLabels: boolean,
    equidistantLeaves: boolean,
    branchNodes: boolean,
    branchLabels: boolean,
    branchDistances: boolean,
    hStretch: number,
    vStretch: number,
    rotation: number,
    ruler: boolean,
    animation: number,
    margin: number[]
}

// consider making a ColorOptions class, renaming this colorOptions.ts
// this class would validate the colorMode, colorList, and selectedNodes properties
// ex: selectedNodes only makes sense for some colorModes
// could also validate colorMode is enum
// could make sure that certain colorModes pass a colorList of length 2