export interface ParamDecorator {
  name: string;
  description: "";
  recommendedTypes: string[];
  parameters?: ParamDecorator[];
}

export interface ArtifactObject {
  name: string;
  type: string;
  internalType: string;
  components?: ArtifactObject[];
  indexed?: boolean;
}

export interface TypeSignatureParseResult {
  name: string;
  items: ParamDecorator[] | ArtifactObject[];
}

interface ParseParamsInnerRes {
  items: (string | ParseParamsInnerRes)[];
  array: string;
}

interface ParseParamsRes {
  res: ParseParamsInnerRes;
  len: number;
}

interface ParseParamsInnerResWithLen {
  items: (string | ParseParamsInnerRes)[];
  array: string;
  length: number;
}

function mapToParamDecorator(paramType: string | ParseParamsInnerResWithLen, index: number): ParamDecorator {
  const name = `param${index + 1}`;

  if (typeof (paramType) === "string") {
    return {
      name: name,
      description: "",
      recommendedTypes: [],
      parameters: null
    };
  } else {
    return {
      name: name,
      description: "",
      recommendedTypes: [],
      parameters: paramType.items.map(mapToParamDecorator)
    };
  }
}

function mapToArtifactObject(paramType: string | ParseParamsInnerResWithLen, index: number): ArtifactObject {
  const name = `param${index + 1}`;

  if (typeof (paramType) === "string") {
    return {
      name: name,
      type: paramType,
      internalType: paramType,
      components: null,
      indexed: null
    };
  } else {
    return {
      name: name,
      type: "tuple" + paramType.array,
      internalType: "tuple" + paramType.array,
      components: paramType.items.map(mapToArtifactObject),
      indexed: null
    };
  }
}

function extractArray(string: string): string {
  for (let index = 0; index < string.length; index++) {
    const char = string[index];

    if (char !== '[' && char !== ']') {
      return string.substring(0, index);
    }
  }

  return ""
}

function parseParams(paramsString): ParseParamsRes {
  const res: ParseParamsInnerRes = {items: [], array: ""};
  let startIndex = 0;
  let index = 0;

  for (; index < paramsString.length; index++) {
    const char = paramsString[index];

    if (char === '(') {
      res.items.push(paramsString.substring(startIndex, index));

      const innerRes = parseParams(paramsString.substring(index + 1));

      index += innerRes.len + 1;
      startIndex = index + 1;

      res.items.push(innerRes.res);
    } else if (char === ')') {
      res.items.push(paramsString.substring(startIndex, index));
      res.array = extractArray(paramsString.substring(index + 1));

      return {res, len: index + res.array.length};
    }
  }

  res.items.push(paramsString.substring(startIndex));

  return {res, len: index};
}

function cleanParamArray(p: string | ParseParamsInnerRes): (string | ParseParamsInnerResWithLen)[] {
  if (typeof (p) === "string") {
    return p.split(",").filter(v => !!v);
  } else {
    const items = p.items.flatMap(cleanParamArray);

    return [{
      items: p.items.flatMap(cleanParamArray),
      array: p.array,
      length: items.length
    }];
  }
}

function mapParams(paramsString: string, isDecorator: boolean): ParamDecorator[] | ArtifactObject[] {
  const parseRes: ParseParamsInnerRes = parseParams(paramsString).res;
  const cleanParams = parseRes.items.flatMap(cleanParamArray).filter(v => v.length > 0);

  if (isDecorator) {
    return cleanParams.map(mapToParamDecorator);
  } else {
    return cleanParams.map(mapToArtifactObject);
  }
}

export function parseTypeSignature(signature: string, isDecorator: boolean): TypeSignatureParseResult {
  const startIndex = signature.indexOf("(");
  const endIndex = signature.lastIndexOf(")");
  const name = signature.substring(0, startIndex);

  const paramsString = signature.substring(startIndex + 1, endIndex);
  const items = mapParams(paramsString, isDecorator);

  return {
    name,
    items
  };
}
