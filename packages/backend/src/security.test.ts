import { obfuscateObject, obfuscateTestOnly as obfuscate } from "@/security";

describe("obfuscate", () => {
  it("should obfuscate the middle part of a string", () => {
    expect(obfuscate("123456")).toBe("12****56");
    expect(obfuscate("abcdef")).toBe("ab****ef");
    expect(obfuscate("0123456789")).toBe("01****89");
    expect(obfuscate("abcde")).toBe("ab****de");
    expect(obfuscate("abcd")).toBe("****");
  });
});

describe("obfuscateObject", () => {
  it('should obfuscate values of keys containing "key"', () => {
    const obj = {
      apiKey: "1234567890",
      nested: {
        secretKey: "abcdefg",
        notAKey: "value",
      },
      regularField: "data",
    };
    const result = obfuscateObject(obj);

    expect(result.apiKey).not.toBe("1234567890");
    expect(result.nested.secretKey).not.toBe("abcdefg");
    expect(result.nested.notAKey).not.toBe("value");
    expect(result.regularField).toBe("data");
  });

  it("should handle empty objects", () => {
    expect(obfuscateObject({})).toEqual({});
  });

  it('should handle objects without keys containing "key"', () => {
    const obj = { field1: "value1", field2: "value2" };
    expect(obfuscateObject(obj)).toEqual(obj);
  });
});
