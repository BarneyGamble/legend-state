export function transformPath(
    path: string[],
    map: Record<string, any>,
    ignoreKeys?: string[],
    passThroughKeys?: string[]
): string[] {
    const data: Record<string, any> = {};
    let d = data;
    for (let i = 0; i < path.length; i++) {
        d = d[path[i]] = i === path.length - 1 ? null : {};
    }
    let value = transformObject(data, map, ignoreKeys, passThroughKeys);
    const pathOut = [];
    for (let i = 0; i < path.length; i++) {
        const key = Object.keys(value)[0];
        pathOut.push(key);
        value = value[key];
    }
    return pathOut;
}

export function transformObject(
    dataIn: Record<string, any>,
    map: Record<string, any>,
    ignoreKeys?: string[],
    passThroughKeys?: string[]
) {
    // Note: If changing this, change it in IndexedDB preloader
    let ret = dataIn;
    if (dataIn) {
        ret = {};

        const dict = Object.keys(map).length === 1 && map['_dict'];

        Object.keys(dataIn).forEach((key) => {
            if (ret[key] !== undefined || ignoreKeys?.includes(key)) return;

            let v = dataIn[key];

            if (dict) {
                ret[key] = transformObject(v, dict, ignoreKeys, passThroughKeys);
            } else {
                const mapped = map[key];
                if (mapped === undefined) {
                    if (passThroughKeys?.includes(key)) {
                        ret[key] = v;
                    } else if (
                        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
                        map[key] === undefined
                    ) {
                        console.error('A fatal field transformation error has occurred', key, dataIn, map);
                        ret[key] = v;
                    }
                } else if (mapped !== null) {
                    if (v !== undefined && v !== null) {
                        if (map[key + '_obj']) {
                            v = transformObject(v, map[key + '_obj'], ignoreKeys, passThroughKeys);
                        } else if (map[key + '_dict']) {
                            const mapChild = map[key + '_dict'];
                            Object.keys(v).forEach((keyChild) => {
                                v[keyChild] = transformObject(v[keyChild], mapChild, ignoreKeys, passThroughKeys);
                            });
                        } else if (map[key + '_arr']) {
                            const mapChild = map[key + '_arr'];
                            v = v.map((vChild) => transformObject(vChild, mapChild, ignoreKeys, passThroughKeys));
                        }
                    }
                    ret[mapped] = v;
                }
            }
            if (process.env.NODE_ENV === 'development' && ret['[object Object]']) debugger;
        });
    }

    if (process.env.NODE_ENV === 'development' && ret && ret['[object Object]']) debugger;

    return ret;
}

const invertedMaps = new WeakMap();

export function invertMap(obj: Record<string, any>) {
    // Note: If changing this, change it in IndexedDB preloader
    const existing = invertedMaps.get(obj);
    if (existing) return existing;

    const target: Record<string, any> = {} as any;

    Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (process.env.NODE_ENV === 'development' && target[val]) debugger;
        if (key === '_dict') {
            target[key] = invertMap(val);
        } else if (key.endsWith('_obj') || key.endsWith('_dict') || key.endsWith('_arr')) {
            const keyMapped = obj[key.replace(/_obj|_dict|_arr$/, '')];
            const suffix = key.match(/_obj|_dict|_arr$/)[0];
            target[keyMapped + suffix] = invertMap(val);
        } else if (typeof val === 'string') {
            target[val] = key;
        }
    });
    if (process.env.NODE_ENV === 'development' && target['[object Object]']) debugger;
    invertedMaps.set(obj, target);

    return target;
}
