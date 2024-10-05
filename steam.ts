interface ApiParameter {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  extra?: ApiParameter[];
}

interface ApiMethod {
  _type?: string; // "undocumented" | "publisher_only"
  version: number;
  httpmethod?: string;
  parameters: ApiParameter[];
  description?: string;
}

type ApiService = Record<string, ApiMethod>;

type ApiSpec = Record<string, ApiService>;

interface OpenAPIParameter {
  name: string;
  in: string;
  required: boolean;
  schema: {
    type: string;
    items?: {
      type: string;
    };
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  description?: string;
}

interface OpenAPIPath {
  summary: string;
  description?: string;
  operationId: string;
  parameters: OpenAPIParameter[];
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: {
          type: string;
          properties: any;
        };
      };
    };
  };
  responses: {
    [key: string]: {
      description?: string;
    };
  };
}

const typeConfig = {
  public: {
    title: "Steam Web API",
    url: "https://api.steampowered.com",
    description:
      "Get your API key from [here](https://steamcommunity.com/dev/apikey)",
  },
  publisher_only: {
    title: "Steam Publisher Web API",
    url: "https://partner.steam-api.com",
    description:
      "Learn how to get your API Key from [here](https://partner.steamgames.com/doc/webapi_overview/auth)",
  },
  undocumented: {
    title: "Steam Web API (Undocumented)",
    url: "https://api.steampowered.com",
    description:
      "Some APIs work with access tokens, if you have one you can provide it here and it will be preferred over the webapi key. Here's how to get a store token: Open https://store.steampowered.com/pointssummary/ajaxgetasyncconfig , Copy the value of webapi_token. Here's how to get a community token: Open https://steamcommunity.com/my/edit/info Run the following script: JSON.parse(application_config.dataset.loyalty_webapi_token) (or manually copy data-loyalty_webapi_token from application_config element)",
  },
};

function convertType(type: string): string {
  switch (type) {
    case "uint32":
    case "uint64":
    case "int32":
    case "int64":
    case "fixed64":
    case "fixed32":
      return "integer";
    case "bool":
      return "boolean";
    case "string":
      return "string";
    case "float":
      return "number";
    case "double":
      return "number";
    case "bytes":
      return "string";
    default:
      return type.toLowerCase();
  }
}

function convertParametersToOpenAPI(parameters: ApiParameter[]): any[] {
  const props: OpenAPIParameter[] = [];
  parameters.forEach((param) => {
    if (param.extra && param.extra.length > 0) {
      const properties = param.extra.reduce(
        (acc, extraParam) => {
          acc[extraParam.name] = {
            type: convertType(extraParam.type),
            description: extraParam.description,
          };
          return acc;
        },
        {} as Record<string, { type: string; description?: string }>,
      );
      props.push({
        name: param.name,
        in: "query",
        description: param.description,
        required: param.optional === false,
        schema: {
          type: "object",
          properties,
          required: param.extra
            .filter((p) => p.optional === false)
            .map((p) => p.name),
        },
      });
      return;
    }
    if (param.name.includes("[0]")) {
      const innerType = convertType(param.type.replace("[]", ""));
      props.push({
        name: param.name.replace("[0]", ""),
        in: "query",
        description: param.description,
        required: param.optional === false,
        schema: {
          type: "array",
          items: {
            type: convertType(innerType),
          },
        },
      });
      return;
    }
    props.push({
      name: param.name,
      in: "query",
      description: param.description,
      required: param.optional === false,
      schema: {
        type: convertType(param.type),
      },
    });
  });
  return props;
}

function convertToOpenAPI(apiSpec: ApiSpec, type: string): any {
  const openAPI = {
    openapi: "3.0.0",
    info: {
      title: typeConfig[type as "public" | "publisher_only"].title,
      description: typeConfig[type as "public" | "publisher_only"].description,
      version: "1.0.0",
    },
    paths: {} as { [key: string]: { [method: string]: OpenAPIPath } },
    servers: [
      {
        url: typeConfig[type as "public" | "publisher_only"].url,
      },
    ],
  };

  for (const [serviceName, serviceMethods] of Object.entries(apiSpec)) {
    for (const [methodName, methodSpec] of Object.entries(serviceMethods)) {
      if (!methodSpec.httpmethod) {
        continue;
      }
      const methodType = methodSpec._type ?? "public";
      if (methodType !== type) {
        continue;
      }
      const path = `/${serviceName}/${methodName}/v${methodSpec.version}`;

      const operationId = `${serviceName}_${methodName}`;
      const parametersSchema = convertParametersToOpenAPI(
        methodSpec.parameters,
      );

      const responses = {
        "200": {
          description: "Successful operation",
        },
        "400": {
          description: "Invalid input",
        },
      };

      openAPI.paths[path] = {
        [methodSpec.httpmethod.toLowerCase()]: {
          summary:
            methodSpec.description ??
            `${methodName} operation of ${serviceName}`,
          description: `Performs the ${methodName} operation`,
          operationId,
          parameters: parametersSchema,
          responses,
        },
      };
    }
  }

  return openAPI;
}

function generateOpenAPIFromFile(type: string) {
  // Read the JSON file

  try {
    const apiSpec: ApiSpec = api;
    const openAPISpec = convertToOpenAPI(apiSpec, type);

    // Write the OpenAPI spec to an output file
    console.log(JSON.stringify(openAPISpec, null, 2));
  } catch (parseErr) {
    console.error("Error parsing JSON input:", parseErr);
  }
}

const run = () => {
  generateOpenAPIFromFile("publisher_only");
};

const api = {
  IAccountCartService: {
    AddItemToCart: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "packageid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "bundleid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "user_country",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "gift_info",
          type: "CartGiftInfo",
          optional: true,
          description: "",
          extra: [
            {
              name: "accountid_giftee",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "gift_message",
              type: "CartGiftMessage",
              optional: true,
              description: "",
              extra: [
                {
                  name: "gifteename",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "message",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "sentiment",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "signature",
                  type: "string",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "time_scheduled_send",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "flags",
          type: "AccountCartLineItemFlags",
          optional: true,
          description: "",
          extra: [
            {
              name: "is_gift",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "is_private",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "navdata",
          type: "CUserInterface_NavData",
          optional: true,
          description: "",
          extra: [
            {
              name: "domain",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "controller",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "method",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "submethod",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "feature",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "depth",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "countrycode",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "webkey",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "is_client",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "curator_data",
              type: "CUserInterface_CuratorData",
              optional: true,
              description: "",
              extra: [
                {
                  name: "clanid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "listid",
                  type: "uint64",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "is_likely_bot",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "is_utm",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    AddItemsToCart: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "user_country",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "items",
          type: "CAccountCart_AddItemsToCart_Request_ItemToAdd",
          optional: true,
          description: "",
        },
        {
          name: "navdata",
          type: "CUserInterface_NavData",
          optional: true,
          description: "",
          extra: [
            {
              name: "domain",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "controller",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "method",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "submethod",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "feature",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "depth",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "countrycode",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "webkey",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "is_client",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "curator_data",
              type: "CUserInterface_CuratorData",
              optional: true,
              description: "",
              extra: [
                {
                  name: "clanid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "listid",
                  type: "uint64",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "is_likely_bot",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "is_utm",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "items[0]",
          type: "CAccountCart_AddItemsToCart_Request_ItemToAdd[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "gift_info",
              type: "CartGiftInfo",
              optional: true,
              description: "",
              extra: [
                {
                  name: "accountid_giftee",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "gift_message",
                  type: "CartGiftMessage",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "gifteename",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "message",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sentiment",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "signature",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "time_scheduled_send",
                  type: "int32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "flags",
              type: "AccountCartLineItemFlags",
              optional: true,
              description: "",
              extra: [
                {
                  name: "is_gift",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "is_private",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
          ],
        },
      ],
    },
    DeleteCart: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetCart: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "user_country",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetRelevantCoupons: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    MergeShoppingCartContents: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "user_country",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    ModifyLineItem: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "line_item_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "user_country",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "gift_info",
          type: "CartGiftInfo",
          optional: true,
          description: "",
          extra: [
            {
              name: "accountid_giftee",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "gift_message",
              type: "CartGiftMessage",
              optional: true,
              description: "",
              extra: [
                {
                  name: "gifteename",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "message",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "sentiment",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "signature",
                  type: "string",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "time_scheduled_send",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "flags",
          type: "AccountCartLineItemFlags",
          optional: true,
          description: "",
          extra: [
            {
              name: "is_gift",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "is_private",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "apply_gidcoupon",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    RemoveItemFromCart: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "line_item_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "user_country",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IAccountLinkingService: {
    GetLinkedAccountInfo: {
      _type: "undocumented",
      version: 1,
      description:
        "List all my active linked external accounts; may be requested to return the access token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "account_type",
          type: "EInternalAccountType",
          optional: true,
          description: "",
        },
        {
          name: "account_id",
          type: "uint64",
          optional: true,
          description: "Internal account ID",
        },
        {
          name: "filter",
          type: "EExternalAccountType",
          optional: true,
          description:
            "if specified then only return this external account type",
        },
        {
          name: "return_access_token",
          type: "bool",
          optional: true,
          description:
            "if provided and true, then returns valid access token if available. It may refresh the token.",
        },
      ],
    },
  },
  IAccountPrivateAppsService: {
    GetPrivateAppList: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    ToggleAppPrivacy: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "private",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "appids[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IAssetSetPublishingService: {
    AddBranchToAssetSet: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "assetset_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "branch",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    CreateAssetSet: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "assetset",
          type: "CAssetSet",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "assetset_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "desc",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "branches[0]",
              type: "string[]",
              optional: true,
              description: "",
            },
            {
              name: "last_update_rtime",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "priority",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "last_publish_rtime",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    DeleteAssetSet: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "assetset_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllAssetSets: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    RemoveBranchFromAssetSet: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "assetset_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "branch",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SwapAssetSetPriority: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "first_assetset_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "second_assetset_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateAssetSet: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "assetset",
          type: "CAssetSet",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "assetset_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "desc",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "branches[0]",
              type: "string[]",
              optional: true,
              description: "",
            },
            {
              name: "last_update_rtime",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "priority",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "last_publish_rtime",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    UpdatePublishTime: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "assetset_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IAuctionService: {
    CancelBid: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "auctiondescriptionid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetBidsForItem: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "auctiondescriptionid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetBidsForUser: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetItemDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "auctiondescriptionid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserBidForItem: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "auctiondescriptionid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    PlaceBid: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "auctiondescriptionid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "amount_bid",
          type: "int64",
          optional: true,
          description: "",
        },
        {
          name: "expected_amount_remaining",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IAuthenticationService: {
    BeginAuthSessionViaCredentials: {
      version: 1,
      httpmethod: "POST",
      description: "start authentication process",
      parameters: [
        {
          name: "device_friendly_name",
          type: "string",
          optional: false,
        },
        {
          name: "account_name",
          type: "string",
          optional: false,
        },
        {
          name: "encrypted_password",
          type: "string",
          optional: false,
          description: "password, RSA encrypted client side",
        },
        {
          name: "encryption_timestamp",
          type: "uint64",
          optional: false,
          description: "timestamp to map to a key - STime",
        },
        {
          name: "remember_login",
          type: "bool",
          optional: false,
          description: "deprecated",
        },
        {
          name: "platform_type",
          type: "{enum}",
          optional: false,
        },
        {
          name: "persistence",
          type: "{enum}",
          optional: true,
          description:
            "whether we are requesting a persistent or an ephemeral session",
        },
        {
          name: "website_id",
          type: "string",
          optional: true,
          description:
            "(EMachineAuthWebDomain) identifier of client requesting auth",
        },
        {
          name: "device_details",
          type: "{message}",
          optional: false,
          description:
            "User-supplied details about the device attempting to sign in",
        },
        {
          name: "guard_data",
          type: "string",
          optional: false,
          description: "steam guard data for client login",
        },
        {
          name: "language",
          type: "uint32",
          optional: false,
        },
        {
          name: "qos_level",
          type: "int32",
          optional: true,
          description:
            "[ENetQOSLevel] client-specified priority for this auth attempt",
        },
      ],
    },
    BeginAuthSessionViaQR: {
      version: 1,
      httpmethod: "POST",
      description: "start authentication process",
      parameters: [
        {
          name: "device_friendly_name",
          type: "string",
          optional: false,
        },
        {
          name: "platform_type",
          type: "{enum}",
          optional: false,
        },
        {
          name: "device_details",
          type: "{message}",
          optional: false,
          description:
            "User-supplied details about the device attempting to sign in",
        },
        {
          name: "website_id",
          type: "string",
          optional: true,
          description:
            "(EMachineAuthWebDomain) identifier of client requesting auth",
        },
      ],
    },
    EnumerateTokens: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Enumerate durable (refresh) tokens for the given subject account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GenerateAccessTokenForApp: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Given a refresh token for a client app audience (e.g. desktop client / mobile client), generate an access token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "refresh_token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "renewal_type",
          type: "ETokenRenewalType",
          optional: true,
          description: "",
        },
      ],
    },
    GetAuthSessionInfo: {
      version: 1,
      httpmethod: "POST",
      description:
        "get metadata of specific auth session, this will also implicitly bind the calling account",
      parameters: [
        {
          name: "client_id",
          type: "uint64",
          optional: false,
          description: "client ID from scanned QR Code, used for routing",
        },
      ],
    },
    GetAuthSessionRiskInfo: {
      version: 1,
      httpmethod: "POST",
      description:
        "get risk metadata for a specific auth session that has been deemed risky",
      parameters: [
        {
          name: "client_id",
          type: "uint64",
          optional: false,
          description: "client ID from scanned QR Code, used for routing",
        },
        {
          name: "language",
          type: "uint32",
          optional: false,
          description: "language for optimistic localization of geoloc data",
        },
      ],
    },
    GetAuthSessionsForAccount: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets all active auth sessions for an account for reference by the mobile app",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetPasswordRSAPublicKey: {
      version: 1,
      httpmethod: "GET",
      description:
        "Fetches RSA public key to use to encrypt passwords for a given account name",
      parameters: [
        {
          name: "account_name",
          type: "string",
          optional: false,
          description: "user-provided account name to get an RSA key for",
        },
      ],
    },
    MigrateMobileSession: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Migrates a WG token to an access and refresh token using a signature generated with the user's 2FA secret",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "Steam ID of the user to migrate",
        },
        {
          name: "token",
          type: "string",
          optional: true,
          description: "WG Token to migrate",
        },
        {
          name: "signature",
          type: "string",
          optional: true,
          description: "Signature over the wg token using the user's 2FA token",
        },
      ],
    },
    PollAuthSessionStatus: {
      version: 1,
      httpmethod: "POST",
      description: "poll during authentication process",
      parameters: [
        {
          name: "client_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "request_id",
          type: "string",
          optional: false,
        },
        {
          name: "token_to_revoke",
          type: "uint64",
          optional: false,
          description:
            "If this is set to a token owned by this user, that token will be retired",
        },
      ],
    },
    RevokeRefreshToken: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Mark the given refresh token as revoked",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "token_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description:
            "Token holder if an admin action on behalf of another user",
        },
        {
          name: "revoke_action",
          type: "EAuthTokenRevokeAction",
          optional: true,
          description: "Select between logout and logout-and-forget-machine",
        },
        {
          name: "signature",
          type: "bytes",
          optional: true,
          description: "required signature over token_id",
        },
      ],
    },
    RevokeToken: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Revoke a single token immediately, making it unable to renew or generate new access tokens",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "revoke_action",
          type: "EAuthTokenRevokeAction",
          optional: true,
          description: "Select between logout and logout-and-forget-machine",
        },
      ],
    },
    UpdateAuthSessionWithMobileConfirmation: {
      version: 1,
      httpmethod: "POST",
      description: "approve an authentication session via mobile 2fa",
      parameters: [
        {
          name: "version",
          type: "int32",
          optional: false,
          description: "version field",
        },
        {
          name: "client_id",
          type: "uint64",
          optional: false,
          description: "pending client ID, from scanned QR Code",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "user who wants to login",
        },
        {
          name: "signature",
          type: "string",
          optional: false,
          description:
            "HMAC digest over {version,client_id,steamid} via user's private key",
        },
        {
          name: "confirm",
          type: "bool",
          optional: true,
          description:
            "Whether to confirm the login (true) or deny the login (false)",
        },
        {
          name: "persistence",
          type: "{enum}",
          optional: true,
          description:
            "whether we are requesting a persistent or an ephemeral session",
        },
      ],
    },
    UpdateAuthSessionWithSteamGuardCode: {
      version: 1,
      httpmethod: "POST",
      description: "approve an authentication session via steam guard code",
      parameters: [
        {
          name: "client_id",
          type: "uint64",
          optional: false,
          description: "pending client ID, from initialized session",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "user who wants to login",
        },
        {
          name: "code",
          type: "string",
          optional: false,
          description: "confirmation code",
        },
        {
          name: "code_type",
          type: "{enum}",
          optional: false,
          description: "type of confirmation code",
        },
      ],
    },
  },
  IAuthenticationSupportService: {
    GetTokenHistory: {
      _type: "undocumented",
      version: 1,
      description: "Gets the audit history for a user's auth token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "token_id",
          type: "fixed64",
          optional: true,
          description: "Token ID of the token to get history for (required)",
        },
      ],
    },
    MarkTokenCompromised: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "token_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    QueryRefreshTokenByID: {
      _type: "undocumented",
      version: 1,
      description:
        "Asks the server for a list of refresh tokens associated with an account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "token_id",
          type: "fixed64",
          optional: true,
          description: "Token ID of the token to look up (required)",
        },
      ],
    },
    QueryRefreshTokensByAccount: {
      _type: "undocumented",
      version: 1,
      description:
        "Asks the server for a list of refresh tokens associated with an account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "SteamID of the account to query (required)",
        },
        {
          name: "include_revoked_tokens",
          type: "bool",
          optional: true,
          description:
            "Includes tokens that are revoked or expired in the query",
        },
      ],
    },
    RevokeToken: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Revokes a user's auth token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "token_id",
          type: "fixed64",
          optional: true,
          description: "Token ID of the token to revoke (required)",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "Steam ID of the owner of that token (required)",
        },
      ],
    },
  },
  IBroadcastClientService: {
    NotifyBroadcastChannelLive: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "broadcast_channel_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "broadcast_channel_avatar",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    NotifyWebRTCAddViewerCandidate: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "webrtc_session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "candidate",
          type: "CBroadcast_WebRTC_Candidate",
          optional: true,
          description: "",
          extra: [
            {
              name: "sdp_mid",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "sdp_mline_index",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "candidate",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IBroadcastService: {
    GetBroadcastUploadStats: {
      _type: "undocumented",
      version: 1,
      description: "Gets broadcast upload stats for user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "row_limit",
          type: "uint32",
          optional: true,
          description: "How many at maximum to return.",
        },
        {
          name: "start_time",
          type: "uint32",
          optional: true,
          description: "Start time",
        },
        {
          name: "upload_id",
          type: "uint64",
          optional: true,
          description:
            "Optional relay upload ID - not compatible with session_id",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description:
            "Optional the steamid whose stats you want, otherwise the user logged in - admin only",
        },
        {
          name: "session_id",
          type: "uint64",
          optional: true,
          description:
            "Optional broadcast session ID - not compatiable with upload_id",
        },
      ],
    },
    GetBroadcastViewerStats: {
      _type: "undocumented",
      version: 1,
      description: "Gets viewer stats for given broadcast",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "upload_id",
          type: "uint64",
          optional: true,
          description: "Get stats for this stream",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description:
            "Optional: The steamid of the broadcast whose details you are requesting.",
        },
      ],
    },
    GetBuildClipStatus: {
      _type: "undocumented",
      version: 1,
      description: "Start building a broadcast clip",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_clip_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetClipDetails: {
      _type: "undocumented",
      version: 1,
      description: "Get details for Broadcast Clips",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_clip_id",
          type: "uint64",
          optional: true,
          description: "List of clip IDs we want details for",
        },
      ],
    },
    GetRTMPInfo: {
      _type: "undocumented",
      version: 1,
      description: "Gets RTMP broadcast info",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ip",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "broadcaster steamID if not logged-in user",
        },
      ],
    },
    MuteBroadcastChatUser: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Mute a user in your broadcast chat",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "user_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "muted",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    PostChatMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Post chat message to specified chat room",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "message",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "instance_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "ELanguage",
          optional: true,
          description:
            "ELanguage of the user posting the message, default is english",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "The two letter country code",
        },
      ],
    },
    PostGameDataFrame: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Add a game meta data frame to broadcast",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "broadcast_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "frame_data",
          type: "string",
          optional: false,
        },
      ],
    },
    PostGameDataFrameRTMP: {
      version: 1,
      httpmethod: "POST",
      description:
        "Add a game meta data frame to broadcast from a client. Uses RTMP token for validation",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of the game being broadcasted",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Broadcasters SteamID",
        },
        {
          name: "rtmp_token",
          type: "string",
          optional: false,
          description: "Valid RTMP token for the Broadcaster",
        },
        {
          name: "frame_data",
          type: "string",
          optional: false,
          description:
            "game data frame expressing current state of game (string, zipped, whatever)",
        },
      ],
    },
    RemoveUserChatText: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Tell all viewers to remove user chat text",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "user_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    SetClipDetails: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Updates a broadcast clip",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_clip_id",
          type: "uint64",
          optional: true,
          description: "Clip ID",
        },
        {
          name: "start_time",
          type: "uint32",
          optional: true,
          description: "start time of the clip",
        },
        {
          name: "end_time",
          type: "uint32",
          optional: true,
          description: "end time of the clip",
        },
        {
          name: "video_description",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SetRTMPInfo: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets RTMP broadcast info",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_permission",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "update_token",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "broadcast_delay",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "app_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "required_app_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "broadcast_chat_permission",
          type: "EBroadcastChatPermission",
          optional: true,
          description:
            "Who is permitted to send a chat message during broadcast",
        },
        {
          name: "broadcast_buffer",
          type: "int32",
          optional: true,
          description: "Previous seconds we keep of the stream available",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "broadcaster steamID if not logged-in user",
        },
        {
          name: "chat_rate_limit",
          type: "uint32",
          optional: true,
          description: "Seconds required between chat messages",
        },
        {
          name: "enable_replay",
          type: "bool",
          optional: true,
          description: "Enable replay of last upload",
        },
        {
          name: "is_partner_chat_only",
          type: "bool",
          optional: true,
          description:
            "When true, then only steamwork partner can create chat messages.",
        },
        {
          name: "wordban_list",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    StartBuildClip: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Start building a broadcast clip",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "broadcast_session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "first_segment",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "num_segments",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "clip_description",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateChatMessageFlair: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Update chat message flair in the specified chat room",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "flair",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    WebRTCSetAnswer: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcaster_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "webrtc_session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "answer",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ICSGOPlayers_730: {
    GetNextMatchSharingCode: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user",
        },
        {
          name: "steamidkey",
          type: "string",
          optional: false,
          description: "Authentication obtained from the SteamID",
        },
        {
          name: "knowncode",
          type: "string",
          optional: false,
          description:
            "Previously known match sharing code obtained from the SteamID",
        },
      ],
    },
    GetPlayerProfile: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerProfileCoin: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The steam ID",
        },
        {
          name: "coin",
          type: "string",
          optional: false,
          description: "The coin",
        },
      ],
    },
  },
  ICSGOServers_730: {
    GetGameMapsPlaytime: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "interval",
          type: "string",
          optional: false,
          description:
            "What recent interval is requested, possible values: day, week, month",
        },
        {
          name: "gamemode",
          type: "string",
          optional: false,
          description:
            "What game mode is requested, possible values: competitive, casual",
        },
        {
          name: "mapgroup",
          type: "string",
          optional: false,
          description: "What maps are requested, possible values: operation",
        },
      ],
    },
    GetGameServersStatus: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetLeaderboardEntries: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMonthlyPlayerCount: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  ICSGOStreamSystem_730: {
    GetMatchScoreboard: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    ListOfUsersSpectating: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  ICSGOTournaments_730: {
    ClaimBadgeReward: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentFantasyLineup: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "event",
          type: "uint32",
          optional: false,
          description: "The event ID",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user inventory",
        },
        {
          name: "steamidkey",
          type: "string",
          optional: false,
          description: "Authentication obtained from the SteamID",
        },
      ],
    },
    GetTournamentItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "event",
          type: "uint32",
          optional: false,
          description: "The event ID",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user inventory",
        },
        {
          name: "steamidkey",
          type: "string",
          optional: false,
          description: "Authentication obtained from the SteamID",
        },
      ],
    },
    GetTournamentLayout: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "event",
          type: "uint32",
          optional: false,
          description: "The event ID",
        },
      ],
    },
    GetTournamentPredictions: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "event",
          type: "uint32",
          optional: false,
          description: "The event ID",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user inventory",
        },
        {
          name: "steamidkey",
          type: "string",
          optional: false,
          description: "Authentication obtained from the SteamID",
        },
      ],
    },
    UploadTournamentFantasyLineup: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "event",
          type: "uint32",
          optional: false,
          description: "The event ID",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user inventory",
        },
        {
          name: "steamidkey",
          type: "string",
          optional: false,
          description: "Authentication obtained from the SteamID",
        },
        {
          name: "sectionid",
          type: "uint32",
          optional: false,
          description: "Event section id",
        },
        {
          name: "pickid0",
          type: "uint32",
          optional: false,
          description: "PickID to select for the slot",
        },
        {
          name: "itemid0",
          type: "uint64",
          optional: false,
          description: "ItemID to lock in for the pick",
        },
        {
          name: "pickid1",
          type: "uint32",
          optional: false,
          description: "PickID to select for the slot",
        },
        {
          name: "itemid1",
          type: "uint64",
          optional: false,
          description: "ItemID to lock in for the pick",
        },
        {
          name: "pickid2",
          type: "uint32",
          optional: false,
          description: "PickID to select for the slot",
        },
        {
          name: "itemid2",
          type: "uint64",
          optional: false,
          description: "ItemID to lock in for the pick",
        },
        {
          name: "pickid3",
          type: "uint32",
          optional: false,
          description: "PickID to select for the slot",
        },
        {
          name: "itemid3",
          type: "uint64",
          optional: false,
          description: "ItemID to lock in for the pick",
        },
        {
          name: "pickid4",
          type: "uint32",
          optional: false,
          description: "PickID to select for the slot",
        },
        {
          name: "itemid4",
          type: "uint64",
          optional: false,
          description: "ItemID to lock in for the pick",
        },
      ],
    },
    UploadTournamentPredictions: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "event",
          type: "uint32",
          optional: false,
          description: "The event ID",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user inventory",
        },
        {
          name: "steamidkey",
          type: "string",
          optional: false,
          description: "Authentication obtained from the SteamID",
        },
        {
          name: "sectionid",
          type: "uint32",
          optional: false,
          description: "Event section id",
        },
        {
          name: "groupid",
          type: "uint32",
          optional: false,
          description: "Event group id",
        },
        {
          name: "index",
          type: "uint32",
          optional: false,
          description: "Index in group",
        },
        {
          name: "pickid",
          type: "uint32",
          optional: false,
          description: "Pick ID to select",
        },
        {
          name: "itemid",
          type: "uint64",
          optional: false,
          description: "ItemID to lock in for the pick",
        },
      ],
    },
  },
  IChatRoomService: {
    AppAddUsersToGroup: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "App invite player(s) to a chat room that it controls, or just extend invite(s)",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "steamids",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "suppress_log_messages",
          type: "bool",
          optional: false,
        },
      ],
    },
    AppPostSystemMessageToGroup: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "App invite a player to a chat room that it controls, or just extend an invite",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "message",
          type: "string",
          optional: false,
        },
        {
          name: "loc_token",
          type: "string",
          optional: false,
        },
        {
          name: "params",
          type: "{message}",
          optional: false,
        },
      ],
    },
    AppRemoveUsersFromGroup: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "App remove player(s) from a chat room that it controls",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "steamid_targets",
          type: "uint64",
          optional: false,
        },
        {
          name: "kick_expiration",
          type: "int32",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid_kick_actor",
          type: "uint64",
          optional: false,
        },
        {
          name: "suppress_log_messages",
          type: "bool",
          optional: false,
        },
      ],
    },
    CreateAppChatRoomGroup: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "App creating a chat room and inviting players to it",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid_owner",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "name",
          type: "string",
          optional: false,
        },
        {
          name: "room_type",
          type: "uint32",
          optional: false,
        },
      ],
    },
    GetMyChatRoomGroups: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetRoleActions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "role_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetRoles: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetRolesForUser: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    MuteUserInGroup: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "expiration",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    RenameRole: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "role_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "name",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    ReplaceRoleActions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "role_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "actions",
          type: "CChatRoleActions",
          optional: true,
          description: "",
          extra: [
            {
              name: "role_id",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "can_create_rename_delete_channel",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_kick",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_ban",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_invite",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_change_tagline_avatar_name",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_chat",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_view_history",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_change_group_roles",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_change_user_roles",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_mention_all",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "can_set_watching_broadcast",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    RevokeInviteToGroup: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    SendChatMessage: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "chat_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "message",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "echo_to_sender",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SetAppChatRoomConfig: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Update the display and rules properties for an app-created chat room",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "name",
          type: "string",
          optional: false,
        },
        {
          name: "avatar_ugc_id",
          type: "uint64",
          optional: false,
        },
        {
          name: "allow_user_invites",
          type: "bool",
          optional: false,
        },
      ],
    },
    SetChatRoomGroupTagline: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "tagline",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SetUserChatGroupPreferences: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "chat_group_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "chat_group_preferences",
          type: "CChatRoom_SetUserChatGroupPreferences_Request.ChatGroupPreferences",
          optional: true,
          description: "",
        },
        {
          name: "chat_room_preferences[0]",
          type: "CChatRoom_SetUserChatGroupPreferences_Request.ChatRoomPreferences[]",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ICheatReportingService: {
    EndSecureMultiplayerSession: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Tell the VAC servers that a secure multiplayer session has ended.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid the user is playing.",
        },
        {
          name: "session_id",
          type: "uint64",
          optional: false,
          description: "session id",
        },
      ],
    },
    GetCheatingReports: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Get a list of cheating reports submitted for this app",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid.",
        },
        {
          name: "timeend",
          type: "uint32",
          optional: false,
          description: "The beginning of the time range .",
        },
        {
          name: "timebegin",
          type: "uint32",
          optional: false,
          description: "The end of the time range.",
        },
        {
          name: "reportidmin",
          type: "uint64",
          optional: false,
          description: "Minimum reportID to include",
        },
        {
          name: "includereports",
          type: "bool",
          optional: true,
          description: "Include reports.",
        },
        {
          name: "includebans",
          type: "bool",
          optional: true,
          description: "Include ban requests.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "Query just for this steamid.",
        },
      ],
    },
    RemovePlayerGameBan: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Remove a ban on a player",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user who is reported as cheating.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid.",
        },
      ],
    },
    ReportCheatData: {
      version: 1,
      httpmethod: "POST",
      description:
        "Reports cheat data. Only use on test account that is running the game but not in a multiplayer session.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user running and reporting the cheat.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid.",
        },
        {
          name: "pathandfilename",
          type: "string",
          optional: false,
          description: "path and file name of the cheat executable.",
        },
        {
          name: "webcheaturl",
          type: "string",
          optional: false,
          description: "web url where the cheat was found and downloaded.",
        },
        {
          name: "time_now",
          type: "uint64",
          optional: false,
          description: "local system time now.",
        },
        {
          name: "time_started",
          type: "uint64",
          optional: false,
          description:
            "local system time when cheat process started. ( 0 if not yet run )",
        },
        {
          name: "time_stopped",
          type: "uint64",
          optional: false,
          description:
            "local system time when cheat process stopped. ( 0 if still running )",
        },
        {
          name: "cheatname",
          type: "string",
          optional: false,
          description: "descriptive name for the cheat.",
        },
        {
          name: "game_process_id",
          type: "uint32",
          optional: false,
          description: "process ID of the running game.",
        },
        {
          name: "cheat_process_id",
          type: "uint32",
          optional: false,
          description: "process ID of the cheat process that ran",
        },
        {
          name: "cheat_param_1",
          type: "uint64",
          optional: false,
          description: "cheat param 1",
        },
        {
          name: "cheat_param_2",
          type: "uint64",
          optional: false,
          description: "cheat param 2",
        },
        {
          name: "cheat_data_dump",
          type: "string",
          optional: false,
          description: "data collection in json format",
        },
      ],
    },
    ReportPlayerCheating: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Reports a player cheating",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user who is reported as cheating.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid.",
        },
        {
          name: "steamidreporter",
          type: "uint64",
          optional: true,
          description:
            "steamid of the user or game server who is reporting the cheating.",
        },
        {
          name: "appdata",
          type: "uint64",
          optional: true,
          description: "App specific data about the cheating.",
        },
        {
          name: "heuristic",
          type: "bool",
          optional: true,
          description:
            "extra information about the source of the cheating - was it a heuristic.",
        },
        {
          name: "detection",
          type: "bool",
          optional: true,
          description:
            "extra information about the source of the cheating - was it a detection.",
        },
        {
          name: "playerreport",
          type: "bool",
          optional: true,
          description:
            "extra information about the source of the cheating - was it a player report.",
        },
        {
          name: "noreportid",
          type: "bool",
          optional: true,
          description: "dont return report id",
        },
        {
          name: "gamemode",
          type: "uint32",
          optional: true,
          description:
            "extra information about state of game - was it a specific type of game play (0 = generic)",
        },
        {
          name: "suspicionstarttime",
          type: "uint32",
          optional: true,
          description:
            "extra information indicating how far back the game thinks is interesting for this user",
        },
        {
          name: "severity",
          type: "uint32",
          optional: true,
          description: "level of severity of bad action being reported",
        },
        {
          name: "matchid",
          type: "uint64",
          optional: true,
          description: "matchid to identify the game instance",
        },
        {
          name: "cheating_type",
          type: "uint64",
          optional: true,
          description: "app specific data about the type of cheating",
        },
        {
          name: "appdata2",
          type: "uint64",
          optional: true,
          description: "App specific data about the cheating.",
        },
        {
          name: "infraction_time",
          type: "uint32",
          optional: true,
          description: "Time when the cheating occured",
        },
        {
          name: "raw_report",
          type: "string",
          optional: true,
          description: "Raw report data",
        },
      ],
    },
    RequestPlayerGameBan: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Requests a ban on a player",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user who is reported as cheating.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid.",
        },
        {
          name: "reportid",
          type: "uint64",
          optional: false,
          description: "The reportid originally used to report cheating.",
        },
        {
          name: "cheatdescription",
          type: "string",
          optional: false,
          description: "Text describing cheating infraction.",
        },
        {
          name: "duration",
          type: "uint32",
          optional: false,
          description: "Ban duration requested in seconds.",
        },
        {
          name: "delayban",
          type: "bool",
          optional: false,
          description: "Delay the ban according to default ban delay rules.",
        },
        {
          name: "flags",
          type: "uint32",
          optional: false,
          description: "Additional information about the ban request.",
        },
        {
          name: "invisible_ban",
          type: "bool",
          optional: false,
          description:
            "The ban will be recorded but not be visible or deny access to secure servers.",
        },
      ],
    },
    RequestVacStatusForUser: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Checks a user's VAC session status. If verification fails, then do not let the user matchmake into a secure game.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid the user is playing.",
        },
        {
          name: "session_id",
          type: "uint64",
          optional: false,
          description: "session id",
        },
        {
          name: "session_flags",
          type: "uint32",
          optional: false,
          description: "session flags",
        },
      ],
    },
    StartSecureMultiplayerSession: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Tell the VAC servers that a secure multiplayer session has started",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamid of the user.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid the user is playing.",
        },
      ],
    },
  },
  ICheckoutService: {
    GetFriendOwnershipForGifting: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "item_ids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    ValidateCart: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "int64",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "gift_info",
          type: "CartGiftInfo",
          optional: true,
          description: "",
          extra: [
            {
              name: "accountid_giftee",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "gift_message",
              type: "CartGiftMessage",
              optional: true,
              description: "",
              extra: [
                {
                  name: "gifteename",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "message",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "sentiment",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "signature",
                  type: "string",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "time_scheduled_send",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "gidreplayoftransid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "for_init_purchase",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    ValidateStartCheckout: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "int64",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IClanFAQSService: {
    CheckFAQPermissions: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    Create: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "internal_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "json_data",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    Delete: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllDrafts: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllFAQsForClan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllLatestVersionPublishedFAQS: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetFAQ: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetFAQVersion: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "version",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    PreviewDraft: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    PublishDraft: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language[0]",
          type: "ELanguage[]",
          optional: true,
          description: "",
        },
      ],
    },
    SearchFAQs: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "search_text",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "elanguages[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "cursor",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "filter_clanids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    SetVisibility: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "visible_in_global_realm",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "visible_in_china_realm",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateDraft: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "ELanguage",
          optional: true,
          description: "",
        },
        {
          name: "content",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "title",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateInternalName: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "internal_name",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateJsonData: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "faq_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "json_data",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IClanService: {
    GetAdjacentPartnerEvents: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftAndRecentPartnerEventSnippet: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "rtime_oldest_date",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPartnerEventsByBuildIDRange: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "cursor",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "requests[0]",
          type: "CClan_GetPartnerEventsByBuildIDRange_Request_PatchNoteRange[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "start_build_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "end_build_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "branch",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetSinglePartnerEvent: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IClientCommService: {
    EnableOrDisableDownloads: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "enable",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllClientLogonInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetClientAppList: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "fields",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "filters",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "include_client_info",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "filter_appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetClientInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetClientLogonInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    InstallClientApp: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    LaunchClientApp: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "query_params",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SetClientAppUpdateState: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "action",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    UninstallClientApp: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_instanceid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IClientMetricsService: {
    ClientBootstrapReport: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "summary",
          type: "CClientMetrics_ClientBootstrap_Summary",
          optional: true,
          description: "",
        },
      ],
    },
    ClientCloudAppSyncStats: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "app_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "platform_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "preload",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "blocking_app_launch",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "files_uploaded",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "files_downloaded",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "files_deleted",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "bytes_uploaded",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "bytes_downloaded",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_total",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_init_caches",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_validate_state",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_ac_launch",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_ac_prep_user_files",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_ac_exit",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_build_sync_list",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_delete_files",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_download_files",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "microsec_upload_files",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "hardware_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "files_managed",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    ClientContentValidationReport: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "validation_result",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "app_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "staged_files",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "user_initiated",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "early_out",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "chunks_scanned",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "chunks_corrupt",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "bytes_scanned",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "chunk_bytes_corrupt",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "total_file_size_corrupt",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    ReportClientError: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "product",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "version",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "errors[0]",
          type: "CClientMetrics_ReportClientError_Notification.Error[]",
          optional: true,
          description: "",
        },
      ],
    },
    ReportReactUsage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "product",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "version",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "routes[0]",
          type: "CClientMetrics_ReportReactUsage_Notification.RouteData[]",
          optional: true,
          description: "",
        },
        {
          name: "components[0]",
          type: "CClientMetrics_ReportReactUsage_Notification.ComponentData[]",
          optional: true,
          description: "",
        },
        {
          name: "actions[0]",
          type: "CClientMetrics_ReportReactUsage_Notification.ActionData[]",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IClientStats_1046930: {
    ReportEvent: {
      version: 1,
      httpmethod: "POST",
      parameters: [],
    },
  },
  ICloudService: {
    BeginAppUploadBatch: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Indicate a batch of files that will be uploaded / deleted for an app.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID for this batch is for.",
        },
        {
          name: "machine_name",
          type: "string",
          optional: true,
          description: "Client machine name (may be user's alias).",
        },
        {
          name: "files_to_upload[0]",
          type: "string[]",
          optional: true,
          description: "Filenames of files to upload in this batch",
        },
        {
          name: "files_to_delete[0]",
          type: "string[]",
          optional: true,
          description: "Filenames of files to delete in this batch",
        },
        {
          name: "client_id",
          type: "uint64",
          optional: true,
          description: "Client ID number",
        },
        {
          name: "app_build_id",
          type: "uint64",
          optional: true,
          description:
            "Current local build of the app which made these changes",
        },
        {
          name: "access_token",
          type: "string",
          optional: false,
          description: "OAuth access token for the user",
        },
        {
          name: "files_to_upload",
          type: "string list",
          optional: false,
          description:
            "List of all files to be uploaded (new files or updates for existing files) as part of\n            this batch.",
        },
        {
          name: "files_to_delete",
          type: "string list",
          optional: false,
          description:
            "List of all files to be deleted from Steam Cloud as part of this batch.",
        },
      ],
    },
    BeginHTTPUpload: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Begins the process of uploading a file to Steam external storage services. File should be uploaded via HTTP PUT to the returned URL, after which the upload must be finalized by a call to CommitHTTPUpload.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID for which the file is being uploaded.",
        },
        {
          name: "file_size",
          type: "uint32",
          optional: true,
          description: "Original file size in bytes.",
        },
        {
          name: "filename",
          type: "string",
          optional: true,
          description: "Name of the file to store in the cloud.",
        },
        {
          name: "file_sha",
          type: "string",
          optional: true,
          description:
            "Hex string (40 digits) representing the SHA1 digest of the file.",
        },
        {
          name: "is_public",
          type: "bool",
          optional: true,
          description:
            "True if the file should be marked public on the UFS, false otherwise.",
        },
        {
          name: "platforms_to_sync[0]",
          type: "string[]",
          optional: true,
          description:
            "Array of string specifying which platforms to sync; value values: all, Windows, MacOS, linux, Switch, iPhoneOS, Android.",
        },
        {
          name: "request_headers_names[0]",
          type: "string[]",
          optional: true,
          description:
            "Names for headers you'll want to set on your upload request. May be left blank.",
        },
        {
          name: "request_headers_values[0]",
          type: "string[]",
          optional: true,
          description:
            "Values for headers you'll want to set on your upload request. The number of names must equal the number of values.",
        },
        {
          name: "upload_batch_id",
          type: "uint64",
          optional: true,
          description:
            "ID of this batch returned by prior BeginAppUploadBatch call.",
        },
      ],
    },
    BeginUGCUpload: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Begins the process of uploading a file to Steam external storage services. File should be uploaded via HTTP PUT to the returned URL, after which the upload must be finalized by a call to CommitHTTPUpload.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID this UGC belongs to.",
        },
        {
          name: "file_size",
          type: "uint32",
          optional: true,
          description: "File size in bytes.",
        },
        {
          name: "filename",
          type: "string",
          optional: true,
          description: "Name of the file.",
        },
        {
          name: "file_sha",
          type: "string",
          optional: true,
          description:
            "Hex string (40 digits) representing the SHA1 digest of the file.",
        },
        {
          name: "content_type",
          type: "string",
          optional: true,
          description: "MIME content type of the file",
        },
      ],
    },
    CommitHTTPUpload: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Commits a file upload initiated by BeginHTTPUpload and transferred via HTTP PUT.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "transfer_succeeded",
          type: "bool",
          optional: true,
          description:
            "True if the HTTP PUT to the upload URL succeeded (URL provided in response to Cloud.BeginHTTPUpload), false if a failure occurred.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description:
            "App ID for which the file is being uploaded. Must match the app ID provided to Cloud.BeginHTTPUpload.",
        },
        {
          name: "file_sha",
          type: "string",
          optional: true,
          description:
            "Hex string (40 digits) representing the SHA1 digest of the file. Must match the SHA1 digest provided to Cloud.BeginHTTPUpload.",
        },
        {
          name: "filename",
          type: "string",
          optional: true,
          description:
            "Filename as specified in the Cloud.BeginHTTPUpload request.",
        },
      ],
    },
    CommitUGCUpload: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Commits a file upload initiated by BeginUGCUpload and transferred via HTTP PUT.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "transfer_succeeded",
          type: "bool",
          optional: true,
          description:
            "True if the HTTP PUT to the upload URL succeeded (URL provided in response to Cloud.BeginUGCUpload), false if a failure occurred.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description:
            "App ID for which the file is being uploaded. Must match the app ID provided to Cloud.BeginUGCUpload.",
        },
        {
          name: "ugcid",
          type: "fixed64",
          optional: true,
          description: "UGC ID of the uploaded file.",
        },
      ],
    },
    CompleteAppUploadBatch: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Indicate that the batch is complete or being stopped for some other reason.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID for this batch is for.",
        },
        {
          name: "batch_id",
          type: "uint64",
          optional: true,
          description: "ID of this batch.",
        },
        {
          name: "batch_eresult",
          type: "uint32",
          optional: true,
          description: "result of this batch.",
        },
      ],
    },
    CompleteAppUploadBatchBlocking: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Indicate that the batch is complete or being stopped for some other reason.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID for this batch is for.",
        },
        {
          name: "batch_id",
          type: "uint64",
          optional: true,
          description: "ID of this batch.",
        },
        {
          name: "batch_eresult",
          type: "uint32",
          optional: true,
          description: "result of this batch.",
        },
      ],
    },
    Delete: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Deletes a file from the user's cloud.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "filename",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID the file belongs to.",
        },
        {
          name: "upload_batch_id",
          type: "uint64",
          optional: true,
          description:
            "ID of this batch returned by prior BeginAppUploadBatch call.",
        },
      ],
    },
    EnumerateUserFiles: {
      _type: "undocumented",
      version: 1,
      description:
        "Enumerates Cloud files for a user of a given app ID. Returns up to 500 files at a time.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID to enumerate the files of.",
        },
        {
          name: "extended_details",
          type: "bool",
          optional: true,
          description:
            "Get extended details back on the files found. Defaults to only returned the app Id and UGC Id of the files found.",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description:
            "Maximum number of results to return on this call. Defaults to a maximum of 500 files returned.",
        },
        {
          name: "start_index",
          type: "uint32",
          optional: true,
          description:
            "Starting index to begin enumeration at. Defaults to the beginning of the list.",
        },
        {
          name: "access_token",
          type: "string",
          optional: false,
          description: "OAuth access token for the user",
        },
      ],
    },
    GetFileDetails: {
      _type: "undocumented",
      version: 1,
      description: "Returns details on a Cloud file.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ugcid",
          type: "uint64",
          optional: true,
          description: "ID of the Cloud file to get details for.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID the file belongs to.",
        },
      ],
    },
    GetUploadServerInfo: {
      _type: "undocumented",
      version: 1,
      description: "Returns the URL of the proper cloud server for a user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App ID to which a file will be uploaded to.",
        },
      ],
    },
    ResumeAppSession: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    SignalAppExitSyncDone: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "uploads_completed",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "uploads_required",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SignalAppLaunchIntent: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "machine_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "ignore_pending_operations",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SuspendAppSession: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "client_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "machine_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "cloud_sync_completed",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ICommunityLinkFilterService: {
    GetLinkFilterHashPrefixes: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "hit_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "start",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetLinkFilterHashes: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "hit_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "start",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetLinkFilterListVersion: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "hit_type",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ICommunityService: {
    ClearSinglePartnerEventsAppPriority: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    ClearUserPartnerEventsAppPriorities: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    DeleteCommentFromThread: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "comment_thread_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "gidfeature",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "gidfeature2",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "gidcomment",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "undelete",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetAppRichPresenceLocalization: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetApps: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "ELanguage",
          optional: true,
          description: "",
        },
      ],
    },
    GetAvatarHistory: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "filter_user_uploaded_only",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetBestEventsForUser: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "include_steam_blog",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "filter_to_played_within_days",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_only_game_updates",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetClanAnnouncementVoteForUser: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "announcementid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetClanAnnouncements: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSingleClanAnnouncement: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetUserPartnerEventNews: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "offset",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtime32_start_time",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtime32_end_time",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "language_preference[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "filter_event_type[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "filter_to_appid",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "count_after",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "count_before",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "app_list[0]",
          type: "CAppPriority[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "priority",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "appid[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IContentFilteringService: {
    FilterStrings: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description:
        "Filter a list of strings in the requested language with rules that match the client.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "int32",
          optional: false,
          description: "AppID that is asking to having filtering performed.",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description:
            "In which language should filtering be performed. If empty, no profanity filtering will be performed.",
        },
        {
          name: "legal_filtering_country",
          type: "string",
          optional: false,
          description:
            "If set to an ISO 3166-1 Alpha-2 country code that requires legal filtering, that legal filtering will be performed.",
        },
        {
          name: "raw_strings",
          type: "string",
          optional: false,
          description: "The list of strings to be filtered.",
        },
        {
          name: "is_name",
          type: "bool",
          optional: false,
          description: "True if the strings are names instead of chat text",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the person viewing the text",
        },
      ],
    },
  },
  IContentServerConfigService: {
    GetSteamCacheNodeParams: {
      version: 1,
      httpmethod: "GET",
      description:
        "Get the operational parameters for a SteamCache node (information the node uses to operate).",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "cache_id",
          type: "uint32",
          optional: false,
          description: "Unique ID number",
        },
        {
          name: "cache_key",
          type: "string",
          optional: false,
          description: "Valid current cache API key",
        },
      ],
    },
    SetSteamCacheClientFilters: {
      version: 1,
      httpmethod: "POST",
      description: "Update the client filters for a SteamCache node",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "cache_id",
          type: "uint32",
          optional: false,
          description: "Unique ID number",
        },
        {
          name: "cache_key",
          type: "string",
          optional: false,
          description: "Valid current cache API key",
        },
        {
          name: "change_notes",
          type: "string",
          optional: false,
          description: "Notes",
        },
        {
          name: "allowed_ip_blocks",
          type: "string",
          optional: false,
          description:
            "comma-separated list of allowed IP address blocks in CIDR format - blank to clear unfilter",
        },
      ],
    },
    SetSteamCachePerformanceStats: {
      version: 1,
      httpmethod: "POST",
      description: "Update the performance/load stats for a SteamCache node",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "cache_id",
          type: "uint32",
          optional: false,
          description: "Unique ID number",
        },
        {
          name: "cache_key",
          type: "string",
          optional: false,
          description: "Valid current cache API key",
        },
        {
          name: "mbps_sent",
          type: "uint32",
          optional: false,
          description: "Outgoing network traffic in Mbps",
        },
        {
          name: "mbps_recv",
          type: "uint32",
          optional: false,
          description: "Incoming network traffic in Mbps",
        },
        {
          name: "cpu_percent",
          type: "uint32",
          optional: false,
          description: "Percent CPU load",
        },
        {
          name: "cache_hit_percent",
          type: "uint32",
          optional: false,
          description: "Percent cache hits",
        },
        {
          name: "num_connected_ips",
          type: "uint32",
          optional: false,
          description: "Number of unique connected IP addresses",
        },
        {
          name: "upstream_egress_utilization",
          type: "uint32",
          optional: false,
          description:
            "(deprecated) What is the percent utilization of the busiest datacenter egress link?",
        },
        {
          name: "upstream_peering_utilization",
          type: "uint32",
          optional: false,
          description:
            "What is the percent utilization of the busiest peering link?",
        },
        {
          name: "upstream_transit_utilization",
          type: "uint32",
          optional: false,
          description:
            "What is the percent utilization of the busiest transit link?",
        },
      ],
    },
  },
  IContentServerDirectoryService: {
    GetCDNAuthToken: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "depot_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "host_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "app_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetCDNForVideo: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "property_type",
          type: "int32",
          optional: false,
          description: "ECDNPropertyType",
        },
        {
          name: "client_ip",
          type: "string",
          optional: false,
          description: "client IP address",
        },
        {
          name: "client_region",
          type: "string",
          optional: false,
          description: "client region",
        },
      ],
    },
    GetClientUpdateHosts: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "cached_signature",
          type: "string",
          optional: false,
        },
      ],
    },
    GetDepotPatchInfo: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "depotid",
          type: "uint32",
          optional: false,
        },
        {
          name: "source_manifestid",
          type: "uint64",
          optional: false,
        },
        {
          name: "target_manifestid",
          type: "uint64",
          optional: false,
        },
      ],
    },
    GetServersForSteamPipe: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "cell_id",
          type: "uint32",
          optional: false,
          description: "client Cell ID",
        },
        {
          name: "max_servers",
          type: "uint32",
          optional: true,
          description: "max servers in response list",
        },
        {
          name: "ip_override",
          type: "string",
          optional: true,
          description: "client IP address",
        },
        {
          name: "launcher_type",
          type: "int32",
          optional: true,
          description: "launcher type",
        },
        {
          name: "ipv6_public",
          type: "string",
          optional: true,
          description: "client public ipv6 address if it knows it",
        },
        {
          name: "current_connections",
          type: "{message}",
          optional: false,
          description: "what sources is the client currently using",
        },
      ],
    },
    PickSingleContentServer: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "property_type",
          type: "int32",
          optional: false,
          description: "ECDNPropertyType",
        },
        {
          name: "cell_id",
          type: "uint32",
          optional: false,
          description: "client Cell ID",
        },
        {
          name: "client_ip",
          type: "string",
          optional: false,
          description: "client IP address",
        },
      ],
    },
  },
  ICredentialsService: {
    SteamGuardPhishingReport: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "SteamGuardPhishingReport",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "param_string",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "ipaddress_actual",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    ValidateEmailAddress: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Validate an email address given a token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "stoken",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IDOTA2AutomatedTourney_570: {
    GetParticipationDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerHistory: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2AutomatedTourney_247040: {
    GetParticipationDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerHistory: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2AutomatedTourney_2305270: {
    GetParticipationDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerHistory: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2CustomGames_570: {
    GetGamePlayerCounts: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPopularGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSuggestedGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetWhitelist: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetWorkshopVoteQueue: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2CustomGames_247040: {
    GetGamePlayerCounts: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPopularGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSuggestedGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetWhitelist: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetWorkshopVoteQueue: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2CustomGames_2305270: {
    GetGamePlayerCounts: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPopularGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSuggestedGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetWhitelist: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetWorkshopVoteQueue: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Events_570: {
    GetArcanaVotes: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetCurrentTriviaQuestions: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftTriviaMatchInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftTriviaVoteCount: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMutations: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTriviaQuestionAnswersSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Events_247040: {
    GetArcanaVotes: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetCurrentTriviaQuestions: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftTriviaMatchInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftTriviaVoteCount: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMutations: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTriviaQuestionAnswersSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Events_2305270: {
    GetArcanaVotes: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetCurrentTriviaQuestions: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftTriviaMatchInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetDraftTriviaVoteCount: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMutations: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTriviaQuestionAnswersSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Fantasy_570: {
    GetFantasyPlayerRawStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfos: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetProPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Fantasy_247040: {
    GetFantasyPlayerRawStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfos: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetProPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Fantasy_2305270: {
    GetFantasyPlayerRawStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfos: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetProPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Guild_570: {
    FindGuildByTag: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGuildPersonaInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGuildSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SearchForOpenGuilds: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Guild_247040: {
    FindGuildByTag: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGuildPersonaInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGuildSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SearchForOpenGuilds: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Guild_2305270: {
    FindGuildByTag: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGuildPersonaInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGuildSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SearchForOpenGuilds: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2League_570: {
    GetLeagueData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeagueInfoList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeagueNodeResults: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeaguesData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLiveGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMessages: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPredictionResults: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPredictions: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPrizePool: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2League_247040: {
    GetLeagueData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeagueInfoList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeagueNodeResults: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeaguesData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLiveGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMessages: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPredictionResults: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPredictions: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPrizePool: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2League_2305270: {
    GetLeagueData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeagueInfoList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeagueNodeResults: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLeaguesData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetLiveGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMessages: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPredictionResults: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPredictions: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPrizePool: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2MatchStats_570: {
    GetRealtimeStats: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "server_steam_id",
          type: "uint64",
          optional: false,
          description: "",
        },
      ],
    },
  },
  IDOTA2MatchStats_247040: {
    GetRealtimeStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2MatchStats_2305270: {
    GetRealtimeStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Match_570: {
    GetLiveLeagueGames: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "league_id",
          type: "uint32",
          optional: true,
          description: "Only show matches of the specified league id",
        },
        {
          name: "match_id",
          type: "uint64",
          optional: true,
          description: "Only show matches of the specified match id",
        },
        {
          name: "dpc",
          type: "bool",
          optional: true,
          description: "Only show matches that are part of the DPC",
        },
      ],
    },
    GetMatchDetails: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "match_id",
          type: "uint64",
          optional: false,
          description: "Match id",
        },
        {
          name: "include_persona_names",
          type: "bool",
          optional: true,
          description: "Include persona names as part of the response",
        },
      ],
    },
    GetMatchHistory: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "hero_id",
          type: "uint32",
          optional: true,
          description:
            "The ID of the hero that must be in the matches being queried",
        },
        {
          name: "game_mode",
          type: "uint32",
          optional: true,
          description: "Which game mode to return matches for",
        },
        {
          name: "skill",
          type: "uint32",
          optional: true,
          description:
            "The average skill range of the match, these can be [1-3] with lower numbers being lower skill. Ignored if an account ID is specified",
        },
        {
          name: "min_players",
          type: "string",
          optional: true,
          description:
            "Minimum number of human players that must be in a match for it to be returned",
        },
        {
          name: "account_id",
          type: "string",
          optional: true,
          description:
            "An account ID to get matches from. This will fail if the user has their match history hidden",
        },
        {
          name: "league_id",
          type: "string",
          optional: true,
          description: "The league ID to return games from",
        },
        {
          name: "start_at_match_id",
          type: "uint64",
          optional: true,
          description: "The minimum match ID to start from",
        },
        {
          name: "matches_requested",
          type: "string",
          optional: true,
          description:
            "The number of requested matches to return (maximum 100)",
        },
      ],
    },
    GetMatchHistoryBySequenceNum: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "start_at_match_seq_num",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "matches_requested",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTeamInfoByTeamID: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "start_at_team_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "teams_requested",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTopLiveEventGame: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "partner",
          type: "int32",
          optional: false,
          description: "Which partner's games to use.",
        },
      ],
    },
    GetTopLiveGame: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "partner",
          type: "int32",
          optional: false,
          description: "Which partner's games to use.",
        },
      ],
    },
    GetTopWeekendTourneyGames: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "partner",
          type: "int32",
          optional: false,
          description: "Which partner's games to use.",
        },
        {
          name: "home_division",
          type: "int32",
          optional: true,
          description: "Prefer matches from this division.",
        },
      ],
    },
    GetTournamentPlayerStats: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "account_id",
          type: "string",
          optional: false,
          description: "",
        },
        {
          name: "league_id",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "hero_id",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "time_frame",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "match_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "phase_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IDOTA2Match_247040: {
    GetLiveLeagueGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMatchDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMatchHistory: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMatchHistoryBySequenceNum: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTeamInfoByTeamID: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTopLiveEventGame: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTopLiveGame: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTopWeekendTourneyGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentPlayerStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Match_2305270: {
    GetLiveLeagueGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMatchDetails: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMatchHistory: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetMatchHistoryBySequenceNum: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTeamInfoByTeamID: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTopLiveEventGame: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTopLiveGame: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTopWeekendTourneyGames: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentPlayerStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Operations_570: {
    GetBannedWordList: {
      _type: "undocumented",
      version: 2,
      parameters: [],
    },
  },
  IDOTA2Operations_247040: {
    GetBannedWordList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Operations_2305270: {
    GetBannedWordList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Plus_570: {
    GetPlusHeroAllyAndEnemyData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlusHeroTimedStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlusStatsData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Plus_247040: {
    GetPlusHeroAllyAndEnemyData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlusHeroTimedStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlusStatsData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Plus_2305270: {
    GetPlusHeroAllyAndEnemyData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlusHeroTimedStats: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlusStatsData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2StreamSystem_570: {
    GetBroadcasterInfo: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "broadcaster_steam_id",
          type: "uint64",
          optional: false,
          description: "64-bit Steam ID of the broadcaster",
        },
        {
          name: "league_id",
          type: "uint32",
          optional: true,
          description: "LeagueID to use if we aren't in a lobby",
        },
      ],
    },
    ListOfUsersSpectating: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2StreamSystem_247040: {
    GetBroadcasterInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    ListOfUsersSpectating: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2StreamSystem_2305270: {
    GetBroadcasterInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    ListOfUsersSpectating: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Teams_570: {
    GetFanContentStatus: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSingleTeamInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTeamInfos: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Teams_247040: {
    GetFanContentStatus: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSingleTeamInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTeamInfos: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Teams_2305270: {
    GetFanContentStatus: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetPlayerInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetSingleTeamInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTeamInfos: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Ticket_570: {
    GetSteamIDForBadgeID: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "BadgeID",
          type: "string",
          optional: false,
          description: "The badge ID",
        },
      ],
    },
    SetSteamAccountPurchased: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The 64-bit Steam ID",
        },
        {
          name: "BadgeType",
          type: "uint32",
          optional: false,
          description: "Badge Type",
        },
      ],
    },
    SteamAccountValidForBadgeType: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The 64-bit Steam ID",
        },
        {
          name: "ValidBadgeType1",
          type: "uint32",
          optional: false,
          description: "Valid Badge Type 1",
        },
        {
          name: "ValidBadgeType2",
          type: "uint32",
          optional: false,
          description: "Valid Badge Type 2",
        },
        {
          name: "ValidBadgeType3",
          type: "uint32",
          optional: false,
          description: "Valid Badge Type 3",
        },
        {
          name: "ValidBadgeType4",
          type: "uint32",
          optional: true,
          description: "Valid Badge Type 4",
        },
      ],
    },
  },
  IDOTA2Ticket_247040: {
    GetSteamIDForBadgeID: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SetSteamAccountPurchased: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SteamAccountValidForBadgeType: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTA2Ticket_2305270: {
    GetSteamIDForBadgeID: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SetSteamAccountPurchased: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SteamAccountValidForBadgeType: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTAChat_570: {
    GetChannelMembers: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTAChat_247040: {
    GetChannelMembers: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDOTAChat_2305270: {
    GetChannelMembers: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IDailyDealService: {
    CancelDailyDeal: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    CreateDailyDeal: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "daily_deal",
          type: "CDailyDeal",
          optional: true,
          description: "",
          extra: [
            {
              name: "gid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "store_item_type",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "store_item_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "store_item_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "discount_event_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creator_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "template_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "internal_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "deleted",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "cancelled",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_cancel_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "asset_request_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "inviteid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    DeleteDailyDeal: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetDailyDeals: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "rtime32_start_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtime32_end_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "store_item_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "search_term",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetDailyDealsForApps: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateDailyDeal: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "daily_deal",
          type: "CDailyDeal",
          optional: true,
          description: "",
          extra: [
            {
              name: "gid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "store_item_type",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "store_item_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "store_item_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "discount_event_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creator_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "template_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "internal_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "deleted",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "cancelled",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_cancel_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "asset_request_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IDataPublisherService: {
    AddVRDeviceInfo: {
      _type: "undocumented",
      version: 1,
      description:
        "Adds a device to the VRDeviceInfo table for the hardware survey",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "manufacturer",
          type: "string",
          optional: true,
          description: "Manufacturer for the new device",
        },
        {
          name: "model",
          type: "string",
          optional: true,
          description: "Model for the new device",
        },
        {
          name: "driver",
          type: "string",
          optional: true,
          description:
            "driver name (not including driver_). e.g. lighthouse, oculus, holographic",
        },
        {
          name: "controller_type",
          type: "string",
          optional: true,
          description:
            "controller type for the device. Can be an empty string for devices with no inputs",
        },
        {
          name: "device_class",
          type: "int32",
          optional: true,
          description:
            "Class of the device. HMD=1, controller=2, tracker=3, base=4",
        },
      ],
    },
    ClientContentCorruptionReport: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "depotid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "download_source",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "objectid",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "cellid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "is_manifest",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "object_size",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "corruption_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "used_https",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "oc_proxy_detected",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetVRDeviceInfo: {
      _type: "undocumented",
      version: 1,
      description: "Generate a debug report of what devices are in the survey",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "month_count",
          type: "uint32",
          optional: true,
          description: "Number of months for which to generate a report",
        },
      ],
    },
    SetVRDeviceInfoAggregationReference: {
      _type: "undocumented",
      version: 1,
      description: "Set the rollup reference of a single VR device",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ref",
          type: "uint32",
          optional: true,
          description:
            "Reference number in the VRDeviceInfo table for the entry to set",
        },
        {
          name: "aggregation_ref",
          type: "uint32",
          optional: true,
          description: "Aggregation to set the entry to",
        },
      ],
    },
  },
  IDeviceAuthService: {
    GetBorrowerPlayHistory: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetExcludedGamesInLibrary: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetOwnAuthorizedDevices: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "include_canceled",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IEconDOTA2_570: {
    GetEventStatsForAccount: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "eventid",
          type: "uint32",
          optional: false,
          description: "The Event ID of the event you're looking for.",
        },
        {
          name: "accountid",
          type: "uint32",
          optional: false,
          description: "The account ID to look up.",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The language to provide hero names in.",
        },
      ],
    },
    GetHeroes: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The language to provide hero names in.",
        },
        {
          name: "itemizedonly",
          type: "bool",
          optional: true,
          description: "Return a list of itemized heroes only.",
        },
      ],
    },
    GetItemCreators: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "itemdef",
          type: "uint32",
          optional: false,
          description: "The item definition to get creator information for.",
        },
      ],
    },
    GetItemWorkshopPublishedFileIDs: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "itemdef",
          type: "uint32",
          optional: false,
          description: "The item definition to get published file ids for.",
        },
      ],
    },
    GetRarities: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The language to provide rarity names in.",
        },
      ],
    },
    GetTournamentPrizePool: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "leagueid",
          type: "uint32",
          optional: true,
          description: "The ID of the league to get the prize pool of",
        },
      ],
    },
  },
  IEconDOTA2_247040: {
    GetEventStatsForAccount: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetHeroes: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetItemCreators: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetItemWorkshopPublishedFileIDs: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetRarities: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentPrizePool: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IEconDOTA2_2305270: {
    GetEventStatsForAccount: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetHeroes: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetItemCreators: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetItemWorkshopPublishedFileIDs: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetRarities: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTournamentPrizePool: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IEconItems_440: {
    GetPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
      ],
    },
    GetSchema: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description:
            "The language to return the names in. Defaults to returning string keys.",
        },
      ],
    },
    GetSchemaItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description:
            "The language to return the names in. Defaults to returning string keys.",
        },
        {
          name: "start",
          type: "int32",
          optional: true,
          description:
            "The first item id to return. Defaults to 0. Response will indicate next value to query if applicable.",
        },
      ],
    },
    GetSchemaOverview: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description:
            "The language to return the names in. Defaults to returning string keys.",
        },
      ],
    },
    GetSchemaURL: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetStoreMetaData: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The language to results in.",
        },
      ],
    },
    GetStoreStatus: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IEconItems_570: {
    GetPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
      ],
    },
    GetStoreMetaData: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The language to results in.",
        },
      ],
    },
  },
  IEconItems_620: {
    GetPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
      ],
    },
    GetSchema: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description:
            "The language to return the names in. Defaults to returning string keys.",
        },
      ],
    },
  },
  IEconItems_730: {
    GetPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
      ],
    },
    GetSchema: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description:
            "The language to return the names in. Defaults to returning string keys.",
        },
      ],
    },
    GetSchemaURL: {
      version: 2,
      httpmethod: "GET",
      parameters: [],
    },
    GetStoreMetaData: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The language to results in.",
        },
      ],
    },
  },
  IEconItems_247040: {
    GetPlayerItems: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetStoreMetaData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IEconItems_583950: {
    GetEquippedPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
        {
          name: "class_id",
          type: "uint32",
          optional: false,
          description: "Return items equipped for this class id",
        },
      ],
    },
  },
  IEconItems_1046930: {
    GetPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
      ],
    },
  },
  IEconItems_1269260: {
    GetEquippedPlayerItems: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
        {
          name: "class_id",
          type: "uint32",
          optional: false,
          description: "Return items equipped for this class id",
        },
      ],
    },
  },
  IEconItems_2305270: {
    GetPlayerItems: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetStoreMetaData: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IEconMarketService: {
    CancelAppListingsForUser: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Cancels all of a user's listings for a specific app ID.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The app making the request",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description:
            "The SteamID of the user whose listings should be canceled",
        },
        {
          name: "synchronous",
          type: "bool",
          optional: false,
          description:
            "Whether or not to wait until all listings have been canceled before returning the response",
        },
        {
          name: "vac",
          type: "bool",
          optional: false,
          description: "This was in response to a VAC ban?",
        },
      ],
    },
    GetAssetID: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Returns the asset ID of the item sold in a listing",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description:
            "The app that's asking. Must match the app of the listing and must belong to the publisher group that owns the API key making the request",
        },
        {
          name: "listingid",
          type: "uint64",
          optional: false,
          description: "The identifier of the listing to get information for",
        },
      ],
    },
    GetMarketEligibility: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description:
        "Checks whether or not an account is allowed to use the market",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the user to check",
        },
      ],
    },
    GetPopular: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Gets the most popular items",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "The language to use in item descriptions",
        },
        {
          name: "rows",
          type: "uint32",
          optional: true,
          description: "Number of rows per page",
        },
        {
          name: "start",
          type: "uint32",
          optional: false,
          description: "The result number to start at",
        },
        {
          name: "filter_appid",
          type: "uint32",
          optional: false,
          description: "If present, the app ID to limit results to",
        },
        {
          name: "ecurrency",
          type: "uint32",
          optional: false,
          description:
            "If present, prices returned will be represented in this currency",
        },
      ],
    },
    LearnItem: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Teaches the market about a kind of item that may be listed on the market in the future.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The app the item belongs to",
        },
        {
          name: "class_name",
          type: "string",
          optional: false,
          description: "Asset class property names",
        },
        {
          name: "class_value",
          type: "string",
          optional: false,
          description: "Asset class property value",
        },
      ],
    },
  },
  IEconService: {
    FlushAssetAppearanceCache: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Flushes the display cache for assets.  This will result in calls to GetAssetClassInfo for each asset class the next time it is displayed.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    FlushContextCache: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Flushes the cache of inventory contents. This will result in calls to GetContexts and GetContextContents to get fresh data for each user next time Steam needs their inventory.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    FlushInventoryCache: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Flushes the cache for a user's inventory in a specific app context",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "User to clear cache for.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "App to clear cache for.",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: false,
          description: "Context to clear cache for.",
        },
      ],
    },
    GetInventoryItemsWithDescriptions: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets a set of items from a users inventory, along with descriptions",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "get_descriptions",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "for_trade_offer_verification",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "filters",
          type: "CEcon_GetInventoryItemsWithDescriptions_Request.FilterOptions",
          optional: true,
          description: "",
        },
        {
          name: "start_assetid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTradeHistory: {
      version: 1,
      httpmethod: "GET",
      description: "Gets a history of trades",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "max_trades",
          type: "uint32",
          optional: false,
          description: "The number of trades to return information for",
        },
        {
          name: "start_after_time",
          type: "uint32",
          optional: false,
          description:
            "The time of the last trade shown on the previous page of results, or the time of the first trade if navigating back",
        },
        {
          name: "start_after_tradeid",
          type: "uint64",
          optional: false,
          description:
            "The tradeid shown on the previous page of results, or the ID of the first trade if navigating back",
        },
        {
          name: "navigating_back",
          type: "bool",
          optional: false,
          description:
            "The user wants the previous page of results, so return the previous max_trades trades before the start time and ID",
        },
        {
          name: "get_descriptions",
          type: "bool",
          optional: false,
          description:
            "If set, the item display data for the items included in the returned trades will also be returned",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "The language to use when loading item display data",
        },
        {
          name: "include_failed",
          type: "bool",
          optional: false,
        },
        {
          name: "include_total",
          type: "bool",
          optional: false,
          description:
            "If set, the total number of trades the account has participated in will be included in the response",
        },
      ],
    },
    GetTradeHoldDurations: {
      version: 1,
      httpmethod: "GET",
      description:
        "Returns the estimated hold duration and end date that a trade with a user would have",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid_target",
          type: "uint64",
          optional: false,
          description: "User you are trading with",
        },
        {
          name: "trade_offer_access_token",
          type: "string",
          optional: false,
          description:
            "A special token that allows for trade offers from non-friends.",
        },
      ],
    },
    GetTradeOffer: {
      version: 1,
      httpmethod: "GET",
      description: "Gets a specific trade offer",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "tradeofferid",
          type: "uint64",
          optional: false,
        },
        {
          name: "language",
          type: "string",
          optional: false,
        },
        {
          name: "get_descriptions",
          type: "bool",
          optional: false,
          description:
            "If set, the item display data for the items included in the returned trade offers will also be returned. If one or more descriptions can't be retrieved, then your request will fail.",
        },
      ],
    },
    GetTradeOffers: {
      version: 1,
      httpmethod: "GET",
      description: "Get a list of sent or received trade offers",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "get_sent_offers",
          type: "bool",
          optional: false,
          description: "Request the list of sent offers.",
        },
        {
          name: "get_received_offers",
          type: "bool",
          optional: false,
          description: "Request the list of received offers.",
        },
        {
          name: "get_descriptions",
          type: "bool",
          optional: false,
          description:
            "If set, the item display data for the items included in the returned trade offers will also be returned. If one or more descriptions can't be retrieved, then your request will fail.",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "The language to use when loading item display data.",
        },
        {
          name: "active_only",
          type: "bool",
          optional: false,
          description:
            "Indicates we should only return offers which are still active, or offers that have changed in state since the time_historical_cutoff",
        },
        {
          name: "historical_only",
          type: "bool",
          optional: false,
          description:
            "Indicates we should only return offers which are not active.",
        },
        {
          name: "time_historical_cutoff",
          type: "uint32",
          optional: false,
          description:
            "When active_only is set, offers updated since this time will also be returned. When historical_only is set, only offers updated since this time are included.",
        },
        {
          name: "cursor",
          type: "uint32",
          optional: true,
          description: "Cursor aka start index",
        },
      ],
    },
    GetTradeOffersSummary: {
      version: 1,
      httpmethod: "GET",
      description: "Get counts of pending and new trade offers",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "time_last_visit",
          type: "uint32",
          optional: false,
          description:
            "The time the user last visited.  If not passed, will use the time the user last visited the trade offer page.",
        },
      ],
    },
    GetTradeStatus: {
      version: 1,
      httpmethod: "GET",
      description: "Gets status for a specific trade",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "tradeid",
          type: "uint64",
          optional: false,
        },
        {
          name: "get_descriptions",
          type: "bool",
          optional: false,
          description:
            "If set, the item display data for the items included in the returned trades will also be returned",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "The language to use when loading item display data",
        },
      ],
    },
  },
  IEmbeddedClientService: {
    AuthorizeDevice: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IFamilyGroupsService: {
    CancelFamilyGroupInvite: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Cancel a pending invite to the specified family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid_to_cancel",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    ClearCooldownSkip: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "invite_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    ConfirmInviteToFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "invite_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "nonce",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    ConfirmJoinFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "invite_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "nonce",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    CreateFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Creates a new family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description:
            "(Support only) User to create this family group for and add to the group.",
        },
      ],
    },
    DeleteFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Delete the specified family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    ForceAcceptInvite: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllPreferredLenders: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetChangeLog: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Return a log of changes made to this family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetDispersionForFamily: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetFamilyGroup: {
      _type: "undocumented",
      version: 1,
      description: "Retrieves family group info",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "send_running_apps",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetFamilyGroupForUser: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets the family group id for the authenticated user or a user specified by a support account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "Actually optional. This should only be set when support or admin accounts needs to fetch the family group for another user. Outside of the support tool it should be omitted.",
        },
        {
          name: "include_family_group_response",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetInviteCheckResults: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetPlaytimeSummary: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Get the playtimes in all apps from the shared library for the whole family group.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetPreferredLenders: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetPurchaseRequests: {
      _type: "undocumented",
      version: 1,
      description: "Get pending purchase requests for the family",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "include_completed",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "request_ids[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "rt_include_completed_since",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetSharedLibraryApps: {
      _type: "undocumented",
      version: 1,
      description: "Return a list of apps available from other members",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "include_own",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_excluded",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_free",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "max_apps",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_non_games",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetUsersSharingDevice: {
      _type: "undocumented",
      version: 1,
      description: "Get lenders or borrowers sharing device with",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "client_session_id",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "client_instance_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    InviteToFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Invites an account to a family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "receiver_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "receiver_role",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    JoinFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Join the specified family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "nonce",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    ModifyFamilyGroupDetails: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Modify the details of the specified family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "name",
          type: "string",
          optional: true,
          description: "If present, set the family name to the current value",
        },
      ],
    },
    RemoveFromFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Remove the specified account from the specified family group",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid_to_remove",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    RequestPurchase: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Request purchase of the specified cart",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "Requester's family group id'",
        },
        {
          name: "gidshoppingcart",
          type: "uint64",
          optional: true,
          description: "The shopping cart with items to purchase.",
        },
        {
          name: "store_country_code",
          type: "string",
          optional: true,
          description: "The store country code of the requestor.",
        },
        {
          name: "use_account_cart",
          type: "bool",
          optional: true,
          description:
            "Request the contents of the account cart instead of gidshoppingcart?",
        },
      ],
    },
    ResendInvitationToFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    RespondToRequestedPurchase: {
      _type: "undocumented",
      version: 1,
      description: "Act on a purchase request",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "Purchase requester's family group id'",
        },
        {
          name: "purchase_requester_steamid",
          type: "fixed64",
          optional: true,
          description: "Purchase requester's steam id'",
        },
        {
          name: "action",
          type: "int32",
          optional: true,
          description: "Action being taken",
        },
        {
          name: "request_id",
          type: "uint64",
          optional: true,
          description: "Unique purchase request ID",
        },
      ],
    },
    SetFamilyCooldownOverrides: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Set the number of times a family group's cooldown time should be ignored for joins.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "The family group to set the cooldown overrides on",
        },
        {
          name: "cooldown_count",
          type: "uint32",
          optional: true,
          description:
            "How many cooldown overrides this family group should have",
        },
      ],
    },
    SetPreferredLender: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "lender_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    UndeleteFamilyGroup: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "family_groupid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IFriendMessagesService: {
    GetActiveMessageSessions: {
      _type: "undocumented",
      version: 1,
      description: "Get information about recent offline messages and chats",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "lastmessage_since",
          type: "uint32",
          optional: true,
          description:
            "return only session information where a chat message has been sent since this time (for polling)",
        },
        {
          name: "only_sessions_with_messages",
          type: "bool",
          optional: true,
          description:
            "If non-zero, return only message sessions that have messages since our message cutoff. If zero, we return all active sessions.",
        },
      ],
    },
    GetRecentMessages: {
      _type: "undocumented",
      version: 1,
      description: "Get a log of recent chat messages between two users",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid1",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "steamid2",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description:
            "If non-zero, cap the number of recent messages to return.",
        },
        {
          name: "most_recent_conversation",
          type: "bool",
          optional: true,
          description:
            "Grab the block of chat from the most recent conversation (a ~5 minute period)",
        },
        {
          name: "rtime32_start_time",
          type: "fixed32",
          optional: true,
          description:
            "If non-zero, return only messages with timestamps greater or equal to this. If zero, we only return messages from a recent time cutoff.",
        },
        {
          name: "bbcode_format",
          type: "bool",
          optional: true,
          description: "Return the results with bbcode formatting.",
        },
        {
          name: "start_ordinal",
          type: "uint32",
          optional: true,
          description:
            "Combined with start time, only messages after this ordinal are returned (dedupes messages in same second)",
        },
        {
          name: "time_last",
          type: "uint32",
          optional: true,
          description: "if present/non-zero, return only messages before this.",
        },
        {
          name: "ordinal_last",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    MarkOfflineMessagesRead: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IFriendsListService: {
    GetFavorites: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetFriendsList: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
  },
  IGCVersion_440: {
    GetClientVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_570: {
    GetClientVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_730: {
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_247040: {
    GetClientVersion: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetServerVersion: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IGCVersion_583950: {
    GetClientVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_1046930: {
    GetClientVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_1269260: {
    GetClientVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_1422450: {
    GetClientVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetServerVersion: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  IGCVersion_2305270: {
    GetClientVersion: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetServerVersion: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IGameCoordinator: {
    GetMessages: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    PostMessages: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  IGameInventory: {
    GetAssetClassInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetAssetPrices: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetContexts: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetHistoryCommandDetails: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The steam ID of the account to operate on",
        },
        {
          name: "command",
          type: "string",
          optional: false,
          description: "The command to run on that asset",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: false,
          description: "The context to fetch history for",
        },
        {
          name: "arguments",
          type: "string",
          optional: false,
          description:
            "The arguments that were provided with the command in the first place",
        },
      ],
    },
    GetItemDefArchive: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetUserHistory: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch history for",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: false,
          description: "The context to fetch history for",
        },
        {
          name: "starttime",
          type: "uint32",
          optional: false,
          description: "Start time of the history range to collect",
        },
        {
          name: "endtime",
          type: "uint32",
          optional: false,
          description: "End time of the history range to collect",
        },
      ],
    },
    HistoryExecuteCommands: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The asset ID to operate on",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: false,
          description: "The context to fetch history for",
        },
        {
          name: "actorid",
          type: "uint32",
          optional: false,
          description:
            "A unique 32 bit ID for the support person executing the command",
        },
      ],
    },
    SupportGetAssetHistory: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "assetid",
          type: "uint64",
          optional: false,
          description: "The asset ID to operate on",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: false,
          description: "The context to fetch history for",
        },
      ],
    },
    UpdateItemDefs: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Steamworks Web API publisher authentication key.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "itemdefs",
          type: "JSON array",
          optional: false,
          description:
            "One or more Item Definitions, presented as a JSON array, to be updated or created.",
        },
      ],
    },
  },
  IGameNotificationsService: {
    CreateSession: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Creates an async game session",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid to create the session for.",
        },
        {
          name: "context",
          type: "uint64",
          optional: false,
          description:
            "Game-specified context value the game can used to associate the session with some object on their backend.",
        },
        {
          name: "title",
          type: "{message}",
          optional: false,
          description:
            "The title of the session to be displayed within each user's list of sessions.",
        },
        {
          name: "users",
          type: "{message}",
          optional: false,
          description: "The initial state of all users in the session.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "steamid to make the request on behalf of -- if specified, the user must be in the session and all users being added to the session must be friends with the user.",
        },
      ],
    },
    DeleteSession: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Deletes an async game session",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sessionid",
          type: "uint64",
          optional: false,
          description: "The sessionid to delete.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid of the session to delete.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "steamid to make the request on behalf of -- if specified, the user must be in the session.",
        },
      ],
    },
    DeleteSessionBatch: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Deletes a batch of async game sessions",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sessionid",
          type: "uint64",
          optional: false,
          description: "The sessionid to delete.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid of the session to delete.",
        },
      ],
    },
    EnumerateSessionsForApp: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Enumerates a user's sessions",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description:
            "The sessionid to request details for. Optional. If not specified, all the user's sessions will be returned.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The user whose sessions are to be enumerated.",
        },
        {
          name: "include_all_user_messages",
          type: "bool",
          optional: true,
          description:
            "Boolean determining whether the message for all users should be included. Defaults to false.",
        },
        {
          name: "include_auth_user_message",
          type: "bool",
          optional: true,
          description:
            "Boolean determining whether the message for the authenticated user should be included. Defaults to false.",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "Language to localize the text in.",
        },
      ],
    },
    GetSessionDetailsForApp: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Get the details for a specific session",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sessions",
          type: "{message}",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid for the sessions.",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "Language to localize the text in.",
        },
      ],
    },
    RequestNotifications: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Requests that a user receive game notifications for an app",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The steamid to request notifications for.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid to request notifications for.",
        },
      ],
    },
    UpdateSession: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Updates a game session",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sessionid",
          type: "uint64",
          optional: false,
          description: "The sessionid to update.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid of the session to update.",
        },
        {
          name: "title",
          type: "{message}",
          optional: true,
          description:
            "The new title of the session.  If not specified, the title will not be changed.",
        },
        {
          name: "users",
          type: "{message}",
          optional: true,
          description:
            "A list of users whose state will be updated to reflect the given state. If the users are not already in the session, they will be added to it.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "steamid to make the request on behalf of -- if specified, the user must be in the session and all users being added to the session must be friends with the user.",
        },
      ],
    },
    UserCreateSession: {
      version: 1,
      httpmethod: "POST",
      description: "Creates an async game session",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid to create the session for.",
        },
        {
          name: "context",
          type: "uint64",
          optional: false,
          description:
            "Game-specified context value the game can used to associate the session with some object on their backend.",
        },
        {
          name: "title",
          type: "{message}",
          optional: false,
          description:
            "The title of the session to be displayed within each user's list of sessions.",
        },
        {
          name: "users",
          type: "{message}",
          optional: false,
          description: "The initial state of all users in the session.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "steamid to make the request on behalf of -- if specified, the user must be in the session and all users being added to the session must be friends with the user.",
        },
      ],
    },
    UserDeleteSession: {
      version: 1,
      httpmethod: "POST",
      description: "Deletes an async game session",
      parameters: [
        {
          name: "sessionid",
          type: "uint64",
          optional: false,
          description: "The sessionid to delete.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid of the session to delete.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "steamid to make the request on behalf of -- if specified, the user must be in the session.",
        },
      ],
    },
    UserUpdateSession: {
      version: 1,
      httpmethod: "POST",
      description: "Updates an async game session",
      parameters: [
        {
          name: "sessionid",
          type: "uint64",
          optional: false,
          description: "The sessionid to update.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The appid of the session to update.",
        },
        {
          name: "title",
          type: "{message}",
          optional: true,
          description:
            "The new title of the session.  If not specified, the title will not be changed.",
        },
        {
          name: "users",
          type: "{message}",
          optional: true,
          description:
            "A list of users whose state will be updated to reflect the given state. If the users are not already in the session, they will be added to it.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "steamid to make the request on behalf of -- if specified, the user must be in the session and all users being added to the session must be friends with the user.",
        },
      ],
    },
  },
  IGameRecordingClipService: {
    GetSharedClips: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetSingleSharedClip: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "clip_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IGameServersService: {
    CreateAccount: {
      version: 1,
      httpmethod: "POST",
      description: "Creates a persistent game server account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The app to use the account for",
        },
        {
          name: "memo",
          type: "string",
          optional: false,
          description: "The memo to set on the new account",
        },
      ],
    },
    DeleteAccount: {
      version: 1,
      httpmethod: "POST",
      description: "Deletes a persistent game server account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the game server account to delete",
        },
      ],
    },
    GetAccountList: {
      version: 1,
      httpmethod: "GET",
      description:
        "Gets a list of game server accounts with their logon tokens",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetAccountPublicInfo: {
      version: 1,
      httpmethod: "GET",
      description: "Gets public information about a given game server account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the game server to get info on",
        },
      ],
    },
    GetServerIPsBySteamID: {
      version: 1,
      httpmethod: "GET",
      description:
        "Gets a list of server IP addresses given a list of SteamIDs",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "server_steamids",
          type: "uint64",
          optional: false,
        },
      ],
    },
    GetServerList: {
      _type: "undocumented",
      version: 1,
      description: "Gets a list of servers given a filter string",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "filter",
          type: "string",
          optional: true,
          description: "Query filter string.",
        },
        {
          name: "limit",
          type: "uint32",
          optional: true,
          description:
            "The maximum number of servers to return in the response",
        },
      ],
    },
    GetServerSteamIDsByIP: {
      version: 1,
      httpmethod: "GET",
      description: "Gets a list of server SteamIDs given a list of IPs",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "server_ips",
          type: "string",
          optional: false,
        },
      ],
    },
    QueryByFakeIP: {
      version: 1,
      httpmethod: "GET",
      description: "Perform a query on a specific server by FakeIP",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "fake_ip",
          type: "uint32",
          optional: false,
          description: "FakeIP of server to query.",
        },
        {
          name: "fake_port",
          type: "uint32",
          optional: false,
          description: "Fake port of server to query.",
        },
        {
          name: "app_id",
          type: "uint32",
          optional: false,
          description: "AppID to use.  Each AppID has its own FakeIP address.",
        },
        {
          name: "query_type",
          type: "{enum}",
          optional: false,
          description: "What type of query?",
        },
      ],
    },
    QueryLoginToken: {
      version: 1,
      httpmethod: "GET",
      description:
        "Queries the status of the specified token, which must be owned by you",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "login_token",
          type: "string",
          optional: false,
          description: "Login token to query",
        },
      ],
    },
    ResetLoginToken: {
      version: 1,
      httpmethod: "POST",
      description: "Generates a new login token for the specified game server",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description:
            "The SteamID of the game server to reset the login token of",
        },
      ],
    },
    SetBanStatus: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "performs a GSLT ban/unban of GSLT associated with a GS. If banning, also bans associated users' GSLTs.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "banned",
          type: "bool",
          optional: false,
        },
        {
          name: "ban_seconds",
          type: "uint32",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    SetMemo: {
      version: 1,
      httpmethod: "POST",
      description:
        "This method changes the memo associated with the game server account. Memos do not affect the account in any way. The memo shows up in the GetAccountList response and serves only as a reminder of what the account is used for.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The SteamID of the game server to set the memo on",
        },
        {
          name: "memo",
          type: "string",
          optional: false,
          description: "The memo to set on the new account",
        },
      ],
    },
  },
  IHelpRequestLogsService: {
    GetApplicationLogDemand: {
      version: 1,
      httpmethod: "POST",
      description:
        "Returns whether the server would like the user to upload logs",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    UploadUserApplicationLog: {
      version: 1,
      httpmethod: "POST",
      description: "User uploading application logs",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "log_type",
          type: "string",
          optional: false,
        },
        {
          name: "version_string",
          type: "string",
          optional: false,
        },
        {
          name: "log_contents",
          type: "string",
          optional: false,
        },
        {
          name: "request_id",
          type: "uint64",
          optional: false,
        },
      ],
    },
  },
  IInventoryService: {
    AddItem: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Adds an item to a user's inventory",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "itemdefid",
          type: "uint64",
          optional: false,
        },
        {
          name: "itempropsjson",
          type: "string",
          optional: false,
        },
        {
          name: "itemquantity",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "notify",
          type: "bool",
          optional: false,
          description:
            "Should notify the user that the item was added to their Steam Inventory.",
        },
        {
          name: "requestid",
          type: "uint64",
          optional: false,
        },
        {
          name: "trade_restriction",
          type: "bool",
          optional: false,
          description:
            "If true, apply the default trade and market restriction times to this item.",
        },
        {
          name: "is_purchase",
          type: "bool",
          optional: true,
          description:
            "If set, treat requestid as a txnid and create this item as a result of user microtransaction purchase.",
        },
      ],
    },
    AddPromoItem: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Adds a promo item to a user's inventory",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "itemdefid",
          type: "uint64",
          optional: false,
        },
        {
          name: "itempropsjson",
          type: "string",
          optional: false,
        },
        {
          name: "itemquantity",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "notify",
          type: "bool",
          optional: false,
          description:
            "Should notify the user that the item was added to their Steam Inventory.",
        },
        {
          name: "requestid",
          type: "uint64",
          optional: false,
        },
        {
          name: "trade_restriction",
          type: "bool",
          optional: false,
          description:
            "If true, apply the default trade and market restriction times to this item.",
        },
        {
          name: "is_purchase",
          type: "bool",
          optional: true,
          description:
            "If set, treat requestid as a txnid and create this item as a result of user microtransaction purchase.",
        },
      ],
    },
    CombineItemStacks: {
      version: 1,
      httpmethod: "POST",
      description: "Combine two stacks of items",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "fromitemid",
          type: "uint64",
          optional: false,
        },
        {
          name: "destitemid",
          type: "uint64",
          optional: false,
        },
        {
          name: "quantity",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
      ],
    },
    Consolidate: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Consolidate items of the given type within an user's inventory",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "itemdefid",
          type: "uint64",
          optional: false,
        },
        {
          name: "force",
          type: "bool",
          optional: true,
        },
      ],
    },
    ConsolidateAll: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Consolidate all items within an user's inventory",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "force",
          type: "bool",
          optional: false,
        },
      ],
    },
    ConsumeItem: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Consume an item",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "itemid",
          type: "uint64",
          optional: true,
          description: "Item ID to be consumed",
        },
        {
          name: "quantity",
          type: "uint32",
          optional: true,
          description: "Amount of the given item stack to be consumed",
        },
        {
          name: "timestamp",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "requestid",
          type: "uint64",
          optional: true,
          description:
            "Clients may provide a unique identifier for a request to perform at most once execution.\n            When a requestid is resubmitted, it will not cause the work to be performed again; the\n            response message will be the current state of items affected by the original successful\n            execution.",
        },
      ],
    },
    ExchangeItem: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Craft an item in a user's inventory",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "materialsitemid",
          type: "uint64",
          optional: false,
        },
        {
          name: "materialsquantity",
          type: "uint32",
          optional: false,
        },
        {
          name: "outputitemdefid",
          type: "uint64",
          optional: false,
        },
      ],
    },
    GetAddItemHistory: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Gets a list of items that have been added to accounts",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "max_results",
          type: "uint32",
          optional: true,
        },
        {
          name: "start_highwater",
          type: "uint64",
          optional: false,
        },
        {
          name: "start_timestamp",
          type: "uint32",
          optional: false,
        },
      ],
    },
    GetInventory: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Retrieves a users inventory as a big JSON blob",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
      ],
    },
    GetItemDefMeta: {
      _type: "undocumented",
      version: 1,
      description:
        "Get metadata about the current item definition for this game.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetItemDefs: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Get item definitions",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "modifiedsince",
          type: "string",
          optional: false,
        },
        {
          name: "itemdefids",
          type: "uint64",
          optional: false,
        },
        {
          name: "workshopids",
          type: "uint64",
          optional: false,
        },
        {
          name: "cache_max_age_seconds",
          type: "uint32",
          optional: true,
          description:
            "Allow stale data to be returned for the specified number of seconds.",
        },
      ],
    },
    GetPriceSheet: {
      version: 1,
      httpmethod: "GET",
      description: "Get the Inventory Service price sheet",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ecurrency",
          type: "int32",
          optional: false,
        },
        {
          name: "currency_code",
          type: "string",
          optional: false,
          description:
            "Standard short code of the requested currency (preferred)",
        },
      ],
    },
    GetQuantity: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Get the total number of available items of the given type",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "itemdefid[0]",
          type: "uint64[]",
          optional: false,
        },
        {
          name: "force",
          type: "bool",
          optional: true,
        },
      ],
    },
    ModifyItems: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Modify an item in a user's inventory",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "updates",
          type: "{message}",
          optional: false,
        },
        {
          name: "timestamp",
          type: "uint32",
          optional: false,
        },
      ],
    },
    SplitItemStack: {
      version: 1,
      httpmethod: "POST",
      description: "Split an item stack into two stacks",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "itemid",
          type: "uint64",
          optional: false,
        },
        {
          name: "quantity",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
      ],
    },
  },
  ILobbyMatchmakingService: {
    CreateLobby: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Creates a lobby and sets its related lobby data",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "max_members",
          type: "int32",
          optional: false,
        },
        {
          name: "lobby_type",
          type: "int32",
          optional: false,
        },
        {
          name: "lobby_name",
          type: "string",
          optional: false,
        },
        {
          name: "steamid_invited_members",
          type: "uint64",
          optional: false,
        },
        {
          name: "lobby_metadata",
          type: "{message}",
          optional: false,
        },
      ],
    },
    GetLobbyData: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description: "Returns lobby data and member list",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid_lobby",
          type: "uint64",
          optional: false,
        },
      ],
    },
    RemoveUserFromLobby: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Removes a user from a lobby",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "steamid_lobby",
          type: "uint64",
          optional: false,
        },
        {
          name: "steamid_to_remove",
          type: "uint64",
          optional: false,
        },
      ],
    },
  },
  ILoyaltyRewardsService: {
    AddReaction: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "target_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "targetid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "reactionid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    BatchedQueryRewardItems: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "requests[0]",
          type: "CLoyaltyRewards_QueryRewardItems_Request[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "time_available",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "community_item_classes[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "cursor",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "sort",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "sort_descending",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "reward_types[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "excluded_community_item_classes[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "definitionids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "filters[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "filter_match_all_category_tags[0]",
              type: "string[]",
              optional: true,
              description: "",
            },
            {
              name: "filter_match_any_category_tags[0]",
              type: "string[]",
              optional: true,
              description: "",
            },
            {
              name: "contains_definitionids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "include_direct_purchase_disabled",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "excluded_content_descriptors[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "excluded_appids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "search_term",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetActivePurchaseBonuses: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetEligibleApps: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetEquippedProfileItems: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetPointsForSpend: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "amount",
          type: "int64",
          optional: true,
          description: "",
        },
        {
          name: "ecurrency",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetProfileCustomizationsConfig: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetReactionConfig: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetReactions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "target_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "targetid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetReactionsSummaryForUser: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetSummary: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    QueryRewardItems: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "time_available",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "community_item_classes[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "cursor",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "sort",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "sort_descending",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "reward_types[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "excluded_community_item_classes[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "definitionids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "filters[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
        {
          name: "filter_match_all_category_tags[0]",
          type: "string[]",
          optional: true,
          description: "",
        },
        {
          name: "filter_match_any_category_tags[0]",
          type: "string[]",
          optional: true,
          description: "",
        },
        {
          name: "contains_definitionids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "include_direct_purchase_disabled",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "excluded_content_descriptors[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "excluded_appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "search_term",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    RedeemPoints: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "defid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "expected_points_cost",
          type: "int64",
          optional: true,
          description: "",
        },
      ],
    },
    RedeemPointsForBadgeLevel: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "defid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "num_levels",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    RedeemPointsForProfileCustomization: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "customization_type",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    RedeemPointsForProfileCustomizationUpgrade: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "customization_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "new_level",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    RedeemPointsToUpgradeItem: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "defid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "expected_points_cost",
          type: "int64",
          optional: true,
          description: "",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    RegisterForSteamDeckRewards: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "serial_number",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "controller_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IMarketingMessagesService: {
    CreateMarketingMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Create a new marketing message.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "message",
          type: "CMarketingMessageProto",
          optional: true,
          description: "",
          extra: [
            {
              name: "gid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "title",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "type",
              type: "EMarketingMessageType",
              optional: true,
              description: "",
            },
            {
              name: "visibility",
              type: "EMarketingMessageVisibility",
              optional: true,
              description: "",
            },
            {
              name: "priority",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "association_type",
              type: "EMarketingMessageAssociationType",
              optional: true,
              description: "",
            },
            {
              name: "associated_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "associated_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "start_date",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "end_date",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "country_allow",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "country_deny",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "ownership_restrictions_overridden",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "must_own_appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_not_own_appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_own_packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_not_own_packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_have_launched_appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "additional_restrictions",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "template_type",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "template_vars",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "flags",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creator_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "template_vars_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "additional_restrictions_json",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "from_json",
          type: "bool",
          optional: true,
          description:
            "If set, then overwrite the template_vars and additional_restrictions keyvalues from json",
        },
      ],
    },
    DeleteMarketingMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Delete a marketing message.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    DoesUserHavePendingMarketingMessages: {
      _type: "undocumented",
      version: 1,
      description:
        "Returns a boolean if the user has pending marketing messages.  Intended to be fast.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "elanguage",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "operating_system",
          type: "int32",
          optional: true,
          description: "EOSType from client",
        },
        {
          name: "client_package_version",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    FindMarketingMessages: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Search for marketing messages by name, type, etc.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "lookup_type",
          type: "EMarketingMessageLookupType",
          optional: true,
          description: "",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "message_type",
          type: "EMarketingMessageType",
          optional: true,
          description: "",
        },
        {
          name: "gidlist[0]",
          type: "fixed64[]",
          optional: true,
          description: "",
        },
        {
          name: "title",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetActiveMarketingMessages: {
      _type: "undocumented",
      version: 1,
      description: "Get a list of active marketing messages.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "country",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "anonymous_user",
          type: "bool",
          optional: true,
          description:
            "Will not return any marketing message that requires ownership/playtime/wishlist",
        },
      ],
    },
    GetDisplayMarketingMessage: {
      _type: "undocumented",
      version: 1,
      description: "Get a single marketing message, cacheable.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "If passed, item data will be returned",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetDisplayMarketingMessageAdmin: {
      _type: "undocumented",
      version: 1,
      description: "Get a single marketing message, cacheable.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "If passed, item data will be returned",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetDisplayMarketingMessageForUser: {
      _type: "undocumented",
      version: 1,
      description:
        "Get a single marketing message, which can be customized per user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "If passed, item data will be returned",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetMarketingMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Get a single marketing message.  Admin account needed for non-active messages",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetMarketingMessageViewerStats: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "For a specific marketing message, then all of the viewership stats for the date range it was intended to be visible to customers",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetMarketingMessagesForApps: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetMarketingMessagesForPartner: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetMarketingMessagesForUser: {
      _type: "undocumented",
      version: 1,
      description:
        "Get a list of active marketing messages filtered for a specific user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "include_seen_messages",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "elanguage",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "operating_system",
          type: "int32",
          optional: true,
          description: "EOSType from client",
        },
        {
          name: "client_package_version",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description:
            "Optional, server can fill in from country code/language if not set",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "If passed, item data will be returned",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetMarketingMessagesViewerRangeStats: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "For a time range, return the seen stats across all of the marketing messages",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "rt_start_time",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rt_end_time",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPartnerMessagePreview: {
      _type: "undocumented",
      version: 1,
      description:
        "partner endpoint to get a marketing message preview that is approved for publishing",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPartnerReadyToPublishMessages: {
      _type: "undocumented",
      version: 1,
      description:
        "Are there any marketing messages that are staged for this partner to control publishing and visibility upon?",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPastMarketingMessages: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "start_past_days",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "upto_past_days",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    MarkMessageSeen: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Mark that a user has viewed a message (so we won't show it again)'.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "display_index",
          type: "uint32",
          optional: true,
          description:
            "Where in the stack was the marketing message, 1-based, zero means we don't know",
        },
        {
          name: "template_type",
          type: "EMarketingMessageTemplateType",
          optional: true,
          description: "Which type of template did they see",
        },
      ],
    },
    PublishPartnerMessage: {
      _type: "undocumented",
      version: 1,
      description: "partner endpoint to publish a marketing message",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateMarketingMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Modify a marketing message.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "message",
          type: "CMarketingMessageProto",
          optional: true,
          description: "",
          extra: [
            {
              name: "gid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "title",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "type",
              type: "EMarketingMessageType",
              optional: true,
              description: "",
            },
            {
              name: "visibility",
              type: "EMarketingMessageVisibility",
              optional: true,
              description: "",
            },
            {
              name: "priority",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "association_type",
              type: "EMarketingMessageAssociationType",
              optional: true,
              description: "",
            },
            {
              name: "associated_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "associated_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "start_date",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "end_date",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "country_allow",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "country_deny",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "ownership_restrictions_overridden",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "must_own_appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_not_own_appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_own_packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_not_own_packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "must_have_launched_appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "additional_restrictions",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "template_type",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "template_vars",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "flags",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creator_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "template_vars_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "additional_restrictions_json",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "from_json",
          type: "bool",
          optional: true,
          description:
            "If set, then overwrite the template_vars and additional_restrictions keyvalues from json",
        },
      ],
    },
  },
  IMobileAppService: {
    GetMobileSummary: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "authenticator_gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IMobileAuthService: {
    GetWGToken: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    MigrateMobileSession: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "signature",
          type: "bytes",
          optional: true,
          description: "",
        },
        {
          name: "device_details",
          type: "CMobileAuth_MigrateMobileSession_Request_DeviceDetails",
          optional: true,
          description: "",
          extra: [
            {
              name: "device_friendly_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "platform_type",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "os_type",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "gaming_device_type",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IMobileDeviceService: {
    DeregisterMobileDevice: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "deviceid",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    RegisterMobileDevice: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "deviceid",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "push_enabled",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "app_version",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "os_version",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "device_model",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "twofactor_device_identifier",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "mobile_app",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IMobileNotificationService: {
    GetUserNotificationCounts: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    SwitchSessionToPush: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  INewsService: {
    ConvertHTMLToBBCode: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "content",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "preserve_newlines",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetBatchPublishedPartnerEvent: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "news_feed_gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "start_index",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "amount",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetNewsFeedByRepublishClan: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "clan_account_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    PreviewPartnerEvents: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "rss_url",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "lang",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    PublishPartnerEvent: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "post",
          type: "CNewsFeedPostDef",
          optional: true,
          description: "",
          extra: [
            {
              name: "gid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "news_feed_gid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "title",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "url",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "author",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "rtime_date",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "contents",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "commited",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "deleted",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "tags",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "appids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "recommendation_state",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "received_compensation",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "received_for_free",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "blurb",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "event_subtitle",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "event_summary",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "draft",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IOnlinePlayService: {
    GetCoPlayStatus: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Get coplay status for two accounts",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Steam ID 1 of request",
        },
        {
          name: "steamid2",
          type: "uint64",
          optional: false,
          description: "Steam ID 2 of request",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "App ID of request",
        },
        {
          name: "time_range_begin",
          type: "uint32",
          optional: false,
          description: "unix time range begin to check",
        },
        {
          name: "time_range_end",
          type: "uint32",
          optional: false,
          description: "unix time range end to check",
        },
      ],
    },
  },
  IParentalService: {
    ApproveFeatureAccess: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Approve or deny temporary access to a feature from a child account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "approve",
          type: "bool",
          optional: true,
          description:
            "Approve or deny temporary access to a feature from a child account",
        },
        {
          name: "requestid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "features",
          type: "uint32",
          optional: true,
          description:
            "Approve or deny temporary access to a feature from a child account",
        },
        {
          name: "duration",
          type: "uint32",
          optional: true,
          description:
            "Approve or deny temporary access to a feature from a child account",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    ApprovePlaytime: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Approve or deny a temporary playtime request from a child account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "approve",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "requestid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "restrictions_approved",
          type: "ParentalTemporaryPlaytimeRestrictions",
          optional: true,
          description: "",
          extra: [
            {
              name: "restrictions",
              type: "ParentalPlaytimeDay",
              optional: true,
              description: "",
              extra: [
                {
                  name: "allowed_time_windows",
                  type: "uint64",
                  optional: true,
                  description: "",
                },
                {
                  name: "allowed_daily_minutes",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "rtime_expires",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    DisableParentalSettings: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Disable parental settings for the logged in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "password",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    EnableParentalSettings: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Enable parental settings for the logged in account, optionally setting the current settings",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "password",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "settings",
          type: "ParentalSettings",
          optional: true,
          description: "",
          extra: [
            {
              name: "steamid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "applist_base_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "applist_base_description",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "applist_base[0]",
              type: "ParentalApp[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "appid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "is_allowed",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "applist_custom[0]",
              type: "ParentalApp[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "appid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "is_allowed",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "passwordhashtype",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "salt",
              type: "bytes",
              optional: true,
              description: "",
            },
            {
              name: "passwordhash",
              type: "bytes",
              optional: true,
              description: "",
            },
            {
              name: "is_enabled",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "enabled_features",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "recovery_email",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "is_site_license_lock",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "temporary_enabled_features",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_temporary_feature_expiration",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "playtime_restrictions",
              type: "ParentalPlaytimeRestrictions",
              optional: true,
              description: "",
              extra: [
                {
                  name: "apply_playtime_restrictions",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "playtime_days[0]",
                  type: "ParentalPlaytimeDay[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "allowed_time_windows",
                      type: "uint64",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "allowed_daily_minutes",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "temporary_playtime_restrictions",
              type: "ParentalTemporaryPlaytimeRestrictions",
              optional: true,
              description: "",
              extra: [
                {
                  name: "restrictions",
                  type: "ParentalPlaytimeDay",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "allowed_time_windows",
                      type: "uint64",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "allowed_daily_minutes",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "rtime_expires",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "excluded_store_content_descriptors[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "excluded_community_content_descriptors[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "utility_appids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "sessionid",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "enablecode",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetParentalSettings: {
      _type: "undocumented",
      version: 1,
      description:
        "Get the current parental settings for the logged in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetRequests: {
      _type: "undocumented",
      version: 1,
      description:
        "Return a list of pending (or pending and completed) feature and playtime requests for the given steamid",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "rt_include_completed_since",
          type: "uint32",
          optional: true,
          description:
            "Return a list of pending (or pending and completed) feature and playtime requests for the given steamid",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description:
            "Return a list of pending (or pending and completed) feature and playtime requests for the given steamid",
        },
        {
          name: "family_groupid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetSignedParentalSettings: {
      _type: "undocumented",
      version: 1,
      description:
        "Get the current parental settings for the logged in account in a form that can by verified by the receiver",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "priority",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    LockClient: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Notify connected clients that a lock has occurred in a browser",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "session",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    RequestFeatureAccess: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Request temporary access to a feature from a parent account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "features",
          type: "uint32",
          optional: true,
          description:
            "Request temporary access to a feature from a parent account",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    RequestPlaytime: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Request temporary additional playtime from a parent account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "time_expires",
          type: "uint32",
          optional: true,
          description:
            "Request temporary additional playtime from a parent account",
        },
        {
          name: "current_playtime_restrictions",
          type: "ParentalPlaytimeDay",
          optional: true,
          description:
            "Request temporary additional playtime from a parent account",
          extra: [
            {
              name: "allowed_time_windows",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "allowed_daily_minutes",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    RequestRecoveryCode: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Request a recovery code be sent to the recovery email address for the specified account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    SetParentalSettings: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Set the current parental settings for the logged in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "password",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "settings",
          type: "ParentalSettings",
          optional: true,
          description: "",
          extra: [
            {
              name: "steamid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "applist_base_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "applist_base_description",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "applist_base[0]",
              type: "ParentalApp[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "appid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "is_allowed",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "applist_custom[0]",
              type: "ParentalApp[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "appid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "is_allowed",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "passwordhashtype",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "salt",
              type: "bytes",
              optional: true,
              description: "",
            },
            {
              name: "passwordhash",
              type: "bytes",
              optional: true,
              description: "",
            },
            {
              name: "is_enabled",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "enabled_features",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "recovery_email",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "is_site_license_lock",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "temporary_enabled_features",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_temporary_feature_expiration",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "playtime_restrictions",
              type: "ParentalPlaytimeRestrictions",
              optional: true,
              description: "",
              extra: [
                {
                  name: "apply_playtime_restrictions",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "playtime_days[0]",
                  type: "ParentalPlaytimeDay[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "allowed_time_windows",
                      type: "uint64",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "allowed_daily_minutes",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "temporary_playtime_restrictions",
              type: "ParentalTemporaryPlaytimeRestrictions",
              optional: true,
              description: "",
              extra: [
                {
                  name: "restrictions",
                  type: "ParentalPlaytimeDay",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "allowed_time_windows",
                      type: "uint64",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "allowed_daily_minutes",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "rtime_expires",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "excluded_store_content_descriptors[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "excluded_community_content_descriptors[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "utility_appids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "new_password",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "sessionid",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    ValidatePassword: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Validate the plaintext password for the logged in account and return an unlock token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "password",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "session",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "send_unlock_on_success",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    ValidateToken: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Check if the given parental unlock token is correct for the logged in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "unlock_token",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPartnerAppNotesService: {
    CreateNotes: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "partner_notes",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "admin_notes",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "partner_readonly_notes",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetMultipleNotes: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetNotes: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateNotes: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "partner_notes",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "admin_notes",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "partner_readonly_notes",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPartnerDeadlineService: {
    GetDeadlineByTimeRange: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "start_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "end_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_complete",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "store_item_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "store_item_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetDeadlinesForPartner: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "start_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "end_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_complete",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPartnerDismissService: {
    CreateDismiss: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "dismiss_list[0]",
          type: "CDismissPinData[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "state",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "accountid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "key_json",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partnerid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_create",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_validity",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "dismiss_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    DeleteDismiss: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "dismiss_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetDismissTimeRange: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "accountid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtime_after",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPartnerMembershipInviteService: {
    GetInvites: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "filter_states[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPartnerStoreBrowseService: {
    GetCountryRestrictions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetItems: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ids",
          type: "StoreItemID",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "request",
          type: "CStoreBrowse_GetItems_Request",
          optional: true,
          description: "",
          extra: [
            {
              name: "ids[0]",
              type: "StoreItemID[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "appid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "packageid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "bundleid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "tagid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "creatorid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "hubcategoryid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "context",
              type: "StoreBrowseContext",
              optional: true,
              description: "",
              extra: [
                {
                  name: "language",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "elanguage",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "country_code",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "steam_realm",
                  type: "int32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
              extra: [
                {
                  name: "include_assets",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_release",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_platforms",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_all_purchase_options",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_screenshots",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_trailers",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_ratings",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_tag_count",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_reviews",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_basic_info",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_supported_languages",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_full_description",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_included_items",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "included_item_data_request",
                  type: "StoreBrowseItemDataRequest",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_assets_without_overrides",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "apply_user_filters",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
          ],
        },
        {
          name: "include_unpublished",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "ids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IPhoneService: {
    ConfirmAddPhoneToAccount: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "stoken",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    IsAccountWaitingForEmailConfirmation: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    SendPhoneVerificationCode: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    SetAccountPhoneNumber: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "phone_number",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "phone_country_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    VerifyAccountPhoneWithCode: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPhysicalGoodsService: {
    CheckInventoryAvailableByPackage: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "packageid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPlayerService: {
    AddFriend: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Invites another Steam user to be a friend",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "Steam ID of user to whom to send a friend invite.",
        },
      ],
    },
    ClientGetLastPlayedTimes: {
      _type: "undocumented",
      version: 1,
      description: "Gets the last-played times for the account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "min_last_played",
          type: "uint32",
          optional: true,
          description:
            "The most recent last-played time the client already knows about",
        },
      ],
    },
    GetAchievementsProgress: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Gets the achievement completion stats for the specified list of apps.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "include_unvetted_apps",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetAnimatedAvatar: {
      _type: "undocumented",
      version: 1,
      description: "Gets which animated avatar is active for a specific user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "The player we're asking about",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetAvatarFrame: {
      _type: "undocumented",
      version: 1,
      description: "Gets which avatar frame is active for a specific user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "The player we're asking about",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetBadges: {
      version: 1,
      httpmethod: "GET",
      description: "Gets badges that are owned by a specific user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
      ],
    },
    GetCommunityBadgeProgress: {
      version: 1,
      httpmethod: "GET",
      description:
        "Gets all the quests needed to get the specified badge, and which are completed",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
        {
          name: "badgeid",
          type: "int32",
          optional: false,
          description: "The badge we're asking about",
        },
      ],
    },
    GetCommunityPreferences: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Returns the player's community preferences",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetFavoriteBadge: {
      _type: "undocumented",
      version: 1,
      description: "Gets the badge the user has set as their favorite",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetFriendsGameplayInfo: {
      _type: "undocumented",
      version: 1,
      description:
        "Get a list of friends who are playing, have played, own, or want a game",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetGameAchievements: {
      _type: "undocumented",
      version: 1,
      description: "Get a games available achievements for display purposes.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "Lowercase, language shortnames",
        },
      ],
    },
    GetMiniProfileBackground: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets which mini profile background is active for a specific user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "The player we're asking about",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetNicknameList: {
      _type: "undocumented",
      version: 1,
      description: "Gets the list of nicknames this user has for other users",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetOwnedGames: {
      version: 1,
      httpmethod: "GET",
      description: "Return a list of games owned by the player",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
        {
          name: "include_appinfo",
          type: "bool",
          optional: false,
          description:
            "true if we want additional details (name, icon) about each game",
        },
        {
          name: "include_played_free_games",
          type: "bool",
          optional: false,
          description:
            "Free games are excluded by default.  If this is set, free games the user has played will be returned.",
        },
        {
          name: "appids_filter",
          type: "uint32",
          optional: false,
          description: "if set, restricts result set to the passed in apps",
        },
        {
          name: "include_free_sub",
          type: "bool",
          optional: false,
          description:
            "Some games are in the free sub, which are excluded by default.",
        },
        {
          name: "skip_unvetted_apps",
          type: "bool",
          optional: true,
          description: "if set, skip unvetted store apps",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "Will return appinfo in this language",
        },
        {
          name: "include_extended_appinfo",
          type: "bool",
          optional: false,
          description:
            "true if we want even more details (capsule, sortas, and capabilities) about each game.  include_appinfo must also be true.",
        },
      ],
    },
    GetPlayerLinkDetails: {
      _type: "undocumented",
      version: 1,
      description: "Replacement for WG GetPlayerLinkDetails",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamids[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetProfileBackground: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets which profile background is active for a specific user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "The player we're asking about",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetProfileCustomization: {
      _type: "undocumented",
      version: 1,
      description: "Returns the customizations (if any) for a profile",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "include_inactive_customizations",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_purchased_customizations",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetProfileItemsEquipped: {
      _type: "undocumented",
      version: 1,
      description: "Returns the items the user has equipped on their profile",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetProfileItemsOwned: {
      _type: "undocumented",
      version: 1,
      description: "Returns the items the user can equip on their profile",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "filters",
          type: "ECommunityItemClass",
          optional: true,
          description: "",
        },
        {
          name: "filters[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetProfileThemesAvailable: {
      _type: "undocumented",
      version: 1,
      description: "Gets themes available for the user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetPurchasedAndUpgradedProfileCustomizations: {
      _type: "undocumented",
      version: 1,
      description: "Returns the purchased and upgraded profile customizations",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetPurchasedProfileCustomizations: {
      _type: "undocumented",
      version: 1,
      description: "Returns the purchased profile customizations",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetRecentPlaytimeSessionsForChild: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetRecentlyPlayedGames: {
      version: 1,
      httpmethod: "GET",
      description: "Gets information about a player's recently played games",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "The number of games to return (0/unset: all)",
        },
      ],
    },
    GetSingleGamePlaytime: {
      _type: "undocumented",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Steamworks Web API user authentication key.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID that we're getting playtime for",
        },
      ],
    },
    GetSteamDeckKeyboardSkin: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets which Steam Deck keyboard skin is active for a specific user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "The player we're asking about",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetSteamLevel: {
      version: 1,
      httpmethod: "GET",
      description: "Returns the Steam Level of a user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
      ],
    },
    GetSteamLevelDistribution: {
      _type: "undocumented",
      version: 1,
      description:
        "Returns how a given Steam Level compares the user base at large",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "player_level",
          type: "uint32",
          optional: false,
        },
      ],
    },
    GetTopAchievementsForGames: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets the best achievements the user has gotten for the specified list of apps.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "max_achievements",
          type: "uint32",
          optional: true,
          description: "The max achievements to load. Max 8",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    IgnoreFriend: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Blocks or unblocks communication with the user.  Despite name, can be a non-friend.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "unignore",
          type: "bool",
          optional: true,
          description:
            "If set, remove from ignore/block list instead of adding",
        },
      ],
    },
    IsPlayingSharedGame: {
      version: 1,
      httpmethod: "GET",
      description: "Obsolete, partners should use ISteamUser.CheckAppOwnership",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The player we're asking about",
        },
        {
          name: "appid_playing",
          type: "uint32",
          optional: false,
          description: "The game player is currently playing",
        },
      ],
    },
    RecordOfflinePlaytime: {
      version: 1,
      httpmethod: "POST",
      description: "Tracks playtime for a user when they are offline",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "ticket",
          type: "string",
          optional: false,
        },
        {
          name: "play_sessions",
          type: "{message}",
          optional: false,
        },
      ],
    },
    RemoveFriend: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Removes a friend or ignores a friend suggestion",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "Steam ID of friend to remove.",
        },
      ],
    },
    SetAnimatedAvatar: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets the user's animated avatar for their profile",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    SetAvatarFrame: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets the user's avatar frame for their profile",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    SetEquippedProfileItemFlags: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets special flags on the equipped item",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "flags",
          type: "uint32",
          optional: true,
          description: "Set of EProfileItemEquippedFlag",
        },
      ],
    },
    SetFavoriteBadge: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets the badge  as the users favorite",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "badgeid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    SetMiniProfileBackground: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets the user's mini profile background",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    SetProfileBackground: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets the user's profile background",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    SetProfilePreferences: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets profile preferences",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "profile_preferences",
          type: "ProfilePreferences",
          optional: true,
          description: "",
          extra: [
            {
              name: "hide_profile_awards",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    SetProfileTheme: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Selects a theme for the profile",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "theme_id",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SetSteamDeckKeyboardSkin: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets the user's current Steam Deck keyboard skin",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPlaytestService: {
    GetInvites: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "invite_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    UpdateInvites: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "invite_ids[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "status",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPortal2Leaderboards_620: {
    GetBucketizedData: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "leaderboardName",
          type: "string",
          optional: false,
          description: "The leaderboard name to fetch data for.",
        },
      ],
    },
  },
  IProductInfoService: {
    SetRichPresenceLocalization: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description:
        "Save and commit rich presence localization for the given app",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "languages",
          type: "{message}",
          optional: false,
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
      ],
    },
  },
  IPromotionEventInvitesService: {
    AcceptInvite: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "inviteid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "rtdatechosen",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "discount_days",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "discount_info",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "skip_discount_event",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    CancelInvite: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "inviteid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllActiveInvites: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetEmailTargets: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "inviteid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetInvite: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "inviteid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "packageid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "bundleid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "promotion_id",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    ResendEmailInvite: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "inviteid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "only_notify_additional_email",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SetInvite: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "invite",
          type: "CPromotionEventInvitation",
          optional: true,
          description: "",
          extra: [
            {
              name: "inviteid",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "invite_account",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtinvitetime",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtexpiretime",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "type",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "accept_account",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtaccepttime",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtdatechosen",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "discount_eventid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "primary_partnerid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "deadlines",
              type: "CPromotionRequirements",
              optional: true,
              description: "",
              extra: [
                {
                  name: "spotlight_due_date",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "marketing_message_due_date",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "discount_event_due_date",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "notify_partner",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "additional_email[0]",
              type: "string[]",
              optional: true,
              description: "",
            },
            {
              name: "promotion_id",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "cancelled",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_cancel_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "require_sale_page",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "require_sale_page_type",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "admin_notes",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_notes",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "queue_email_to_send",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPromotionPlanningService: {
    CreatePlan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "plan",
          type: "CPromotionPlan",
          optional: true,
          description: "",
          extra: [
            {
              name: "promotion_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "admin_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "input_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_end_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "input_access_key",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    CreateSalePageForPromo: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "clan_account_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "clan_event_gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "rtime_sale_start",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtime_sale_end",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "daily_deal_gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "promotion_gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "create_asset_request",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "partner_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "advertising_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    CreateTentativePlan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "plan",
          type: "CPromotionPlan",
          optional: true,
          description: "",
          extra: [
            {
              name: "promotion_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "admin_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "input_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_end_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "input_access_key",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    DeletePlan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetAdvertisingAppsForPartner: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partner_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllActivePlan: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetAllPlansForApps: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "exclude_sales",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "exclude_direct_featuring",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllPlansForPartner: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "start_date_after_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "start_date_before_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "show_hidden",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "start_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "end_date",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetAvailableWeekSlots: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publisherid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtime_start",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPlan: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetPlanByInputAccessKey: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "input_access_key",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetPlanCompletedInDateRange: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "oldest_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "newest_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "promotion_types[0]",
          type: "string[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetPlansUpdatedSince: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "upto_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPromotionPlanForSalePages: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "request_list[0]",
          type: "CPromotionPlanning_GetPromotionPlanForSalePages_Request_CSalePage[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "clan_account_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "gid_clan_event",
              type: "fixed64",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetPromotionPlanPackageSales: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "promotion_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetPromotionPlanSummarySales: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "num_weeks",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "promotion_types[0]",
          type: "string[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetSalePageCandidatesForPromo: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "account_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_published",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetUpcomingScheduledDiscounts: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "rtstart",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rtend",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_packages",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "filter_modified_sales_rank",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    MarkLocalizationAssetComplete: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "value",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SearchPlan: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "token",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SendNotification: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "notification_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "only_explicit_email_addresses",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    UpdatePlan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "plan",
          type: "CPromotionPlan",
          optional: true,
          description: "",
          extra: [
            {
              name: "promotion_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "admin_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "input_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_end_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "input_access_key",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    UpdatePlanInputData: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "plan",
          type: "CPromotionPlan",
          optional: true,
          description: "",
          extra: [
            {
              name: "promotion_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "admin_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "input_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_end_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "input_access_key",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    UpdatePlanPartnerInfo: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "plan",
          type: "CPromotionPlan",
          optional: true,
          description: "",
          extra: [
            {
              name: "promotion_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "admin_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "input_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime32_end_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "input_access_key",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "last_update_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "partner_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "partner_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_readonly_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "assets_writable_jsondata",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "promotion_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPromotionStatsService: {
    GetOptInDemoStats: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "opt_in_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "partner_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IPublishedFileService: {
    CanSubscribe: {
      _type: "undocumented",
      version: 1,
      description: "Check if the user can subscribe to the published file",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    Delete: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Deletes a published file.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
          description: "Published file id of the file we'd like to delete.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    GetDetails: {
      version: 1,
      httpmethod: "GET",
      description: "Retrieves information about a set of published files.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileids[0]",
          type: "uint64[]",
          optional: false,
          description: "Set of published file Ids to retrieve details for.",
        },
        {
          name: "includetags",
          type: "bool",
          optional: false,
          description:
            "If true, return tag information in the returned details.",
        },
        {
          name: "includeadditionalpreviews",
          type: "bool",
          optional: false,
          description:
            "If true, return preview information in the returned details.",
        },
        {
          name: "includechildren",
          type: "bool",
          optional: false,
          description: "If true, return children in the returned details.",
        },
        {
          name: "includekvtags",
          type: "bool",
          optional: false,
          description:
            "If true, return key value tags in the returned details.",
        },
        {
          name: "includevotes",
          type: "bool",
          optional: false,
          description: "If true, return vote data in the returned details.",
        },
        {
          name: "short_description",
          type: "bool",
          optional: false,
          description:
            "If true, return a short description instead of the full description.",
        },
        {
          name: "includeforsaledata",
          type: "bool",
          optional: false,
          description: "If true, return pricing data, if applicable.",
        },
        {
          name: "includemetadata",
          type: "bool",
          optional: false,
          description: "If true, populate the metadata field.",
        },
        {
          name: "language",
          type: "ELanguage",
          optional: true,
          description:
            "Specifies the localized text to return. Defaults to English.",
        },
        {
          name: "return_playtime_stats",
          type: "uint32",
          optional: false,
          description:
            "Return playtime stats for the specified number of days before today.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "strip_description_bbcode",
          type: "bool",
          optional: false,
          description: "Strips BBCode from descriptions.",
        },
        {
          name: "desired_revision",
          type: "EPublishedFileRevision",
          optional: true,
          description: "Return the data for the specified revision.",
        },
        {
          name: "includereactions",
          type: "bool",
          optional: true,
          description: "If true, then reactions to items will be returned.",
        },
        {
          name: "admin_query",
          type: "bool",
          optional: false,
          description: "Admin tool is doing a query, return hidden items",
        },
      ],
    },
    GetSubSectionData: {
      version: 1,
      httpmethod: "GET",
      description:
        "Get sub section data (for table of contents, a specific section, or all)",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "for_table_of_contents",
          type: "bool",
          optional: false,
        },
        {
          name: "specific_sectionid",
          type: "uint64",
          optional: false,
        },
        {
          name: "desired_revision",
          type: "{enum}",
          optional: true,
          description: "Return the data for the specified revision.",
        },
      ],
    },
    GetUserFileCount: {
      version: 1,
      httpmethod: "GET",
      description:
        "Retrieves a count of files published by a user. Uses the same messages as GetUserFiles but totalonly must be true.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Steam ID of the user whose files are being requested.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "App Id of the app that the files were published to.",
        },
        {
          name: "shortcutid",
          type: "uint32",
          optional: true,
          description: "Shortcut Id to retrieve published files from.",
        },
        {
          name: "page",
          type: "uint32",
          optional: true,
          description: "Starting page for results.",
        },
        {
          name: "numperpage",
          type: "uint32",
          optional: true,
          description: "The number of results, per page to return.",
        },
        {
          name: "type",
          type: "string",
          optional: true,
          description: "Type of files to be returned.",
        },
        {
          name: "sortmethod",
          type: "string",
          optional: true,
          description: "Sorting method to use on returned values.",
        },
        {
          name: "privacy",
          type: "uint32",
          optional: true,
          description: "Filter by privacy settings.",
        },
        {
          name: "requiredtags",
          type: "string",
          optional: true,
          description:
            "Tags that must be present on a published file to satisfy the query.",
        },
        {
          name: "excludedtags",
          type: "string",
          optional: true,
          description:
            "Tags that must NOT be present on a published file to satisfy the query.",
        },
        {
          name: "required_kv_tags",
          type: "{message}",
          optional: false,
          description: "Required key-value tags to match on.",
        },
        {
          name: "filetype",
          type: "uint32",
          optional: true,
          description: "File type to match files to.",
        },
        {
          name: "creator_appid",
          type: "uint32",
          optional: false,
          description:
            "App Id of the app that published the files, only matched if specified.",
        },
        {
          name: "match_cloud_filename",
          type: "string",
          optional: false,
          description: "Match this cloud filename if specified.",
        },
        {
          name: "cache_max_age_seconds",
          type: "uint32",
          optional: true,
          description:
            "Allow stale data to be returned for the specified number of seconds.",
        },
        {
          name: "language",
          type: "int32",
          optional: true,
          description:
            "Specifies the localized text to return. Defaults to English.",
        },
        {
          name: "taggroups",
          type: "{message}",
          optional: true,
          description:
            "At least one of the tags must be present on a published file to satisfy the query.",
        },
        {
          name: "excluded_content_descriptors",
          type: "{enum}",
          optional: true,
          description: "Filter out items that have these content descriptors.",
        },
        {
          name: "admin_query",
          type: "bool",
          optional: false,
          description: "Admin tool is doing a query, return hidden items",
        },
        {
          name: "totalonly",
          type: "bool",
          optional: true,
          description:
            "If true, only return the total number of files that satisfy this query.",
        },
        {
          name: "ids_only",
          type: "bool",
          optional: true,
          description:
            "If true, only return the published file ids of files that satisfy this query.",
        },
        {
          name: "return_vote_data",
          type: "bool",
          optional: true,
          description: "Return vote data",
        },
        {
          name: "return_tags",
          type: "bool",
          optional: false,
          description: "Return tags in the file details",
        },
        {
          name: "return_kv_tags",
          type: "bool",
          optional: true,
          description: "Return key-value tags in the file details",
        },
        {
          name: "return_previews",
          type: "bool",
          optional: false,
          description:
            "Return preview image and video details in the file details",
        },
        {
          name: "return_children",
          type: "bool",
          optional: false,
          description: "Return child item ids in the file details",
        },
        {
          name: "return_short_description",
          type: "bool",
          optional: true,
          description:
            "Populate the short_description field instead of file_description",
        },
        {
          name: "return_for_sale_data",
          type: "bool",
          optional: false,
          description: "Return pricing information, if applicable",
        },
        {
          name: "return_metadata",
          type: "bool",
          optional: true,
          description: "Populate the metadata field",
        },
        {
          name: "return_playtime_stats",
          type: "uint32",
          optional: false,
          description:
            "Return playtime stats for the specified number of days before today.",
        },
        {
          name: "strip_description_bbcode",
          type: "bool",
          optional: false,
          description: "Strips BBCode from descriptions.",
        },
        {
          name: "return_reactions",
          type: "bool",
          optional: true,
          description: "If true, then reactions to items will be returned.",
        },
        {
          name: "startindex_override",
          type: "uint32",
          optional: false,
          description: "Backwards compatible for the client.",
        },
        {
          name: "desired_revision",
          type: "{enum}",
          optional: true,
          description: "Return the data for the specified revision.",
        },
        {
          name: "return_apps",
          type: "bool",
          optional: false,
          description: "Return list of apps the items belong to",
        },
      ],
    },
    GetUserFiles: {
      version: 1,
      httpmethod: "GET",
      description: "Retrieves files published by a user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Steam ID of the user whose files are being requested.",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "App Id of the app that the files were published to.",
        },
        {
          name: "shortcutid",
          type: "uint32",
          optional: true,
          description: "Shortcut Id to retrieve published files from.",
        },
        {
          name: "page",
          type: "uint32",
          optional: true,
          description: "Starting page for results.",
        },
        {
          name: "numperpage",
          type: "uint32",
          optional: true,
          description: "The number of results, per page to return.",
        },
        {
          name: "type",
          type: "string",
          optional: true,
          description: "Type of files to be returned.",
        },
        {
          name: "sortmethod",
          type: "string",
          optional: true,
          description: "Sorting method to use on returned values.",
        },
        {
          name: "privacy",
          type: "uint32",
          optional: true,
          description: "Filter by privacy settings.",
        },
        {
          name: "requiredtags",
          type: "string",
          optional: true,
          description:
            "Tags that must be present on a published file to satisfy the query.",
        },
        {
          name: "excludedtags",
          type: "string",
          optional: true,
          description:
            "Tags that must NOT be present on a published file to satisfy the query.",
        },
        {
          name: "required_kv_tags",
          type: "{message}",
          optional: false,
          description: "Required key-value tags to match on.",
        },
        {
          name: "filetype",
          type: "uint32",
          optional: true,
          description: "File type to match files to.",
        },
        {
          name: "creator_appid",
          type: "uint32",
          optional: false,
          description:
            "App Id of the app that published the files, only matched if specified.",
        },
        {
          name: "match_cloud_filename",
          type: "string",
          optional: false,
          description: "Match this cloud filename if specified.",
        },
        {
          name: "cache_max_age_seconds",
          type: "uint32",
          optional: true,
          description:
            "Allow stale data to be returned for the specified number of seconds.",
        },
        {
          name: "language",
          type: "ELanguage",
          optional: true,
          description:
            "Specifies the localized text to return. Defaults to English.",
        },
        {
          name: "taggroups",
          type: "{message}",
          optional: true,
          description:
            "At least one of the tags must be present on a published file to satisfy the query.",
        },
        {
          name: "excluded_content_descriptors",
          type: "{enum}",
          optional: true,
          description: "Filter out items that have these content descriptors.",
        },
        {
          name: "admin_query",
          type: "bool",
          optional: false,
          description: "Admin tool is doing a query, return hidden items",
        },
        {
          name: "totalonly",
          type: "bool",
          optional: true,
          description:
            "If true, only return the total number of files that satisfy this query.",
        },
        {
          name: "ids_only",
          type: "bool",
          optional: true,
          description:
            "If true, only return the published file ids of files that satisfy this query.",
        },
        {
          name: "return_vote_data",
          type: "bool",
          optional: true,
          description: "Return vote data",
        },
        {
          name: "return_tags",
          type: "bool",
          optional: false,
          description: "Return tags in the file details",
        },
        {
          name: "return_kv_tags",
          type: "bool",
          optional: true,
          description: "Return key-value tags in the file details",
        },
        {
          name: "return_previews",
          type: "bool",
          optional: false,
          description:
            "Return preview image and video details in the file details",
        },
        {
          name: "return_children",
          type: "bool",
          optional: false,
          description: "Return child item ids in the file details",
        },
        {
          name: "return_short_description",
          type: "bool",
          optional: true,
          description:
            "Populate the short_description field instead of file_description",
        },
        {
          name: "return_for_sale_data",
          type: "bool",
          optional: false,
          description: "Return pricing information, if applicable",
        },
        {
          name: "return_metadata",
          type: "bool",
          optional: true,
          description: "Populate the metadata field",
        },
        {
          name: "return_playtime_stats",
          type: "uint32",
          optional: false,
          description:
            "Return playtime stats for the specified number of days before today.",
        },
        {
          name: "strip_description_bbcode",
          type: "bool",
          optional: false,
          description: "Strips BBCode from descriptions.",
        },
        {
          name: "return_reactions",
          type: "bool",
          optional: true,
          description: "If true, then reactions to items will be returned.",
        },
        {
          name: "startindex_override",
          type: "uint32",
          optional: false,
          description: "Backwards compatible for the client.",
        },
        {
          name: "desired_revision",
          type: "EPublishedFileRevision",
          optional: true,
          description: "Return the data for the specified revision.",
        },
        {
          name: "return_apps",
          type: "bool",
          optional: false,
          description: "Return list of apps the items belong to",
        },
      ],
    },
    GetUserVoteSummary: {
      version: 1,
      httpmethod: "GET",
      description: "Get user vote summary",
      parameters: [
        {
          name: "publishedfileids[0]",
          type: "uint64[]",
          optional: false,
        },
      ],
    },
    Publish: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Publishes a clouded user file to the Workshop.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App Id this file is being published FROM.",
        },
        {
          name: "consumer_appid",
          type: "uint32",
          optional: true,
          description: "App Id this file is being published TO.",
        },
        {
          name: "cloudfilename",
          type: "string",
          optional: true,
          description: "Name of the file to publish in the user's cloud.",
        },
        {
          name: "preview_cloudfilename",
          type: "string",
          optional: true,
          description:
            "Name of the file to use as the published file's preview.",
        },
        {
          name: "title",
          type: "string",
          optional: true,
          description: "Text title for the published file.",
        },
        {
          name: "file_description",
          type: "string",
          optional: true,
          description: "Text description for the published file.",
        },
        {
          name: "file_type",
          type: "uint32",
          optional: true,
          description: "(EWorkshopFileType) Type of Workshop file to publish.",
        },
        {
          name: "consumer_shortcut_name",
          type: "string",
          optional: true,
          description: "Shortcut name for the published file.",
        },
        {
          name: "youtube_username",
          type: "string",
          optional: true,
          description: "User's YouTube account username.",
        },
        {
          name: "youtube_videoid",
          type: "string",
          optional: true,
          description: "Video Id of a YouTube video for this published file.",
        },
        {
          name: "visibility",
          type: "uint32",
          optional: true,
          description:
            "(ERemoteStoragePublishedFileVisibility) Visibility of the published file (private, friends, public, etc.)",
        },
        {
          name: "redirect_uri",
          type: "string",
          optional: true,
          description:
            "If supplied, the resulting published file's Id is appended to the URI.",
        },
        {
          name: "tags[0]",
          type: "string[]",
          optional: true,
          description: "Array of text tags to apply to the published file.",
        },
        {
          name: "collection_type",
          type: "string",
          optional: true,
          description: "Type of collection the published file represents.",
        },
        {
          name: "game_type",
          type: "string",
          optional: true,
          description: "Type of game the published file represents.",
        },
        {
          name: "url",
          type: "string",
          optional: true,
          description:
            "If this represents a game, this is the URL to that game's page.",
        },
      ],
    },
    QueryFiles: {
      version: 1,
      httpmethod: "GET",
      description: "Performs a search query for published files",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "query_type",
          type: "EPublishedFileQueryType",
          optional: false,
          description: "enumeration EPublishedFileQueryType in clientenums.h",
        },
        {
          name: "page",
          type: "uint32",
          optional: false,
          description: "Current page",
        },
        {
          name: "cursor",
          type: "string",
          optional: false,
          description:
            "Cursor to paginate through the results (set to '*' for the first request).  Prefer this over using the page parameter, as it will allow you to do deep pagination.  When used, the page parameter will be ignored.",
        },
        {
          name: "numperpage",
          type: "uint32",
          optional: true,
          description: "The number of results, per page to return.",
        },
        {
          name: "creator_appid",
          type: "uint32",
          optional: false,
          description: "App that created the files",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "App that consumes the files",
        },
        {
          name: "requiredtags",
          type: "string",
          optional: false,
          description: "Tags to match on. See match_all_tags parameter below",
        },
        {
          name: "excludedtags",
          type: "string",
          optional: true,
          description:
            "Tags that must NOT be present on a published file to satisfy the query.",
        },
        {
          name: "match_all_tags",
          type: "bool",
          optional: true,
          description:
            "If true, then items must have all the tags specified, otherwise they must have at least one of the tags.",
        },
        {
          name: "required_flags",
          type: "string",
          optional: false,
          description: "Required flags that must be set on any returned items",
        },
        {
          name: "omitted_flags",
          type: "string",
          optional: false,
          description: "Flags that must not be set on any returned items",
        },
        {
          name: "search_text",
          type: "string",
          optional: false,
          description: "Text to match in the item's title or description",
        },
        {
          name: "filetype",
          type: "uint32",
          optional: false,
          description: "EPublishedFileInfoMatchingFileType",
        },
        {
          name: "child_publishedfileid",
          type: "uint64",
          optional: false,
          description: "Find all items that reference the given item.",
        },
        {
          name: "days",
          type: "uint32",
          optional: false,
          description:
            "If query_type is k_PublishedFileQueryType_RankedByTrend, then this is the number of days to get votes for [1,7].",
        },
        {
          name: "include_recent_votes_only",
          type: "bool",
          optional: false,
          description:
            "If query_type is k_PublishedFileQueryType_RankedByTrend, then limit result set just to items that have votes within the day range given",
        },
        {
          name: "cache_max_age_seconds",
          type: "uint32",
          optional: true,
          description:
            "Allow stale data to be returned for the specified number of seconds.",
        },
        {
          name: "language",
          type: "ELanguage",
          optional: true,
          description:
            "Language to search in and also what gets returned. Defaults to English.",
        },
        {
          name: "required_kv_tags",
          type: "{message}",
          optional: false,
          description: "Required key-value tags to match on.",
        },
        {
          name: "taggroups",
          type: "{message}",
          optional: true,
          description:
            "At least one of the tags must be present on a published file to satisfy the query.",
        },
        {
          name: "date_range_created",
          type: "{message}",
          optional: true,
          description: "Filter to items created within this range.",
        },
        {
          name: "date_range_updated",
          type: "{message}",
          optional: true,
          description: "Filter to items updated within this range.",
        },
        {
          name: "excluded_content_descriptors",
          type: "{enum}",
          optional: true,
          description: "Filter out items that have these content descriptors.",
        },
        {
          name: "admin_query",
          type: "bool",
          optional: false,
          description: "Admin tool is doing a query, return hidden items",
        },
        {
          name: "totalonly",
          type: "bool",
          optional: true,
          description:
            "If true, only return the total number of files that satisfy this query.",
        },
        {
          name: "ids_only",
          type: "bool",
          optional: true,
          description:
            "If true, only return the published file ids of files that satisfy this query.",
        },
        {
          name: "return_vote_data",
          type: "bool",
          optional: false,
          description: "Return vote data",
        },
        {
          name: "return_tags",
          type: "bool",
          optional: false,
          description: "Return tags in the file details",
        },
        {
          name: "return_kv_tags",
          type: "bool",
          optional: false,
          description: "Return key-value tags in the file details",
        },
        {
          name: "return_previews",
          type: "bool",
          optional: false,
          description:
            "Return preview image and video details in the file details",
        },
        {
          name: "return_children",
          type: "bool",
          optional: false,
          description: "Return child item ids in the file details",
        },
        {
          name: "return_short_description",
          type: "bool",
          optional: false,
          description:
            "Populate the short_description field instead of file_description",
        },
        {
          name: "return_for_sale_data",
          type: "bool",
          optional: false,
          description: "Return pricing information, if applicable",
        },
        {
          name: "return_metadata",
          type: "bool",
          optional: true,
          description: "Populate the metadata",
        },
        {
          name: "return_playtime_stats",
          type: "uint32",
          optional: false,
          description:
            "Return playtime stats for the specified number of days before today.",
        },
        {
          name: "return_details",
          type: "bool",
          optional: false,
          description:
            "By default, if none of the other 'return_*' fields are set, only some voting details are returned. Set this to true to return the default set of details.",
        },
        {
          name: "strip_description_bbcode",
          type: "bool",
          optional: false,
          description: "Strips BBCode from descriptions.",
        },
        {
          name: "desired_revision",
          type: "EPublishedFileRevision",
          optional: true,
          description: "Return the data for the specified revision.",
        },
        {
          name: "return_reactions",
          type: "bool",
          optional: true,
          description: "If true, then reactions to items will be returned.",
        },
      ],
    },
    RefreshVotingQueue: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Refresh the voting queue for the user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "matching_file_type",
          type: "uint32",
          optional: false,
          description: "EPublishedFileInfoMatchingFileType",
        },
        {
          name: "tags",
          type: "string",
          optional: false,
          description:
            "Include files that have all the tags or any of the tags if match_all_tags is set to false.",
        },
        {
          name: "match_all_tags",
          type: "bool",
          optional: true,
          description:
            "If true, then files must have all the tags specified.  If false, then must have at least one of the tags specified.",
        },
        {
          name: "excluded_tags",
          type: "string",
          optional: false,
          description: "Exclude any files that have any of these tags.",
        },
        {
          name: "desired_queue_size",
          type: "uint32",
          optional: false,
          description:
            "Desired number of items in the voting queue.  May be clamped by the server",
        },
        {
          name: "desired_revision",
          type: "EPublishedFileRevision",
          optional: true,
          description:
            "Filter to items that have data for the specified revision.",
        },
      ],
    },
    SetDeveloperMetadata: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Sets the metadata for a developer on the published file",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "metadata",
          type: "string",
          optional: false,
        },
      ],
    },
    Subscribe: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Subscribes the user to the published file",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "list_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "notify_client",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_dependencies",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    Unsubscribe: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Unsubscribes the user from the published file",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "list_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "notify_client",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    Update: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Updates information about a published file.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "App Id this published file belongs to.",
        },
        {
          name: "publishedfileid",
          type: "fixed64",
          optional: true,
          description: "Published file id of the file we'd like update.",
        },
        {
          name: "title",
          type: "string",
          optional: true,
          description: "Title of the published file.",
        },
        {
          name: "file_description",
          type: "string",
          optional: true,
          description: "Description of the published file.",
        },
        {
          name: "visibility",
          type: "uint32",
          optional: true,
          description: "Visibility of the published file.",
        },
        {
          name: "tags[0]",
          type: "string[]",
          optional: true,
          description: "Set of tags for the published file.",
        },
        {
          name: "filename",
          type: "string",
          optional: true,
          description: "Filename for the published file.",
        },
        {
          name: "preview_filename",
          type: "string",
          optional: true,
          description: "Preview filename for the published file.",
        },
        {
          name: "spoiler_tag",
          type: "bool",
          optional: true,
          description:
            "Whether this published file should have a spoiler tag attached to it.",
        },
        {
          name: "image_width",
          type: "uint32",
          optional: true,
          description:
            "If this is an image file, you can specify the image width.",
        },
        {
          name: "image_height",
          type: "uint32",
          optional: true,
          description:
            "If this is an image file, you can specify the image height.",
        },
        {
          name: "language",
          type: "int32",
          optional: true,
          description: "If setting title & description, what language to set",
        },
      ],
    },
    UpdateAppUGCBan: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Adds/updates/removes a UGC ban in the app",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "expiration_time",
          type: "uint32",
          optional: false,
        },
        {
          name: "reason",
          type: "string",
          optional: false,
        },
      ],
    },
    UpdateBanStatus: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Updates the ban status on the item",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "banned",
          type: "bool",
          optional: false,
        },
        {
          name: "reason",
          type: "string",
          optional: false,
        },
      ],
    },
    UpdateIncompatibleStatus: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Update the incompatible status on the item",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "incompatible",
          type: "bool",
          optional: false,
        },
      ],
    },
    UpdateKeyValueTags: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Updates key/value tags for a published file",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "tags_to_add",
          type: "{message}",
          optional: false,
        },
        {
          name: "tags_to_remove",
          type: "{message}",
          optional: false,
        },
        {
          name: "string_tags_to_remove_by_key",
          type: "string",
          optional: false,
        },
        {
          name: "int_tags_to_remove_by_key",
          type: "string",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    UpdateTags: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Updates tags on the published file",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "add_tags",
          type: "string",
          optional: false,
        },
        {
          name: "remove_tags",
          type: "string",
          optional: false,
        },
        {
          name: "language",
          type: "ELanguage",
          optional: false,
        },
      ],
    },
    Vote: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "User wants to vote on the item",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
        },
        {
          name: "vote_up",
          type: "bool",
          optional: false,
        },
      ],
    },
  },
  IPublishingService: {
    CreatePartnerAppOptInEmails: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "opt_in_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "targeting_flag",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "settings_flag",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "email_templates",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "start_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "end_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetEstimatePartnerAppOptInEmail: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "email_def_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetOptInAppealsSummaryStats: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "opt_in_names[0]",
          type: "string[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetOptInEmailTracking: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "email_def_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetPartnerAppOptInEmailDefAndStats: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "opt_in_name",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetPartnerPaidGivenPackageList: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "packageids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetSinglePartnerAppOptIn: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    SendPartnerOptInEmailAndWait: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "email_def_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "force_resend",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SetFeaturingOnPartnerAppOptIn: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "additional_featuring",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "opt_in_name",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    TestFirePartnerAppOptInEmail: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "email_def_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "partnerid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    UpdatePartnerAppOptInEmails: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "email_def_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "targeting_flag",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "settings_flag",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "email_templates",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "start_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "end_rtime",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "reviewed",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IQuestService: {
    ActivateProfileModifierItem: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "communityitemid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "activate",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetCommunityInventory: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "filter_appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetCommunityItemDefinitions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "item_type",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "broadcast_channel_id",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "keyvalues_as_json",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetNumTradingCardsEarned: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "timestamp_start",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "timestamp_end",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetVirtualItemRewardDefinition: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "eventid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "include_inactive",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    PublisherAddCommunityItemsToPlayer: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Add game items to a user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "match_item_type",
          type: "uint32",
          optional: false,
        },
        {
          name: "match_item_class",
          type: "uint32",
          optional: false,
        },
        {
          name: "prefix_item_name",
          type: "string",
          optional: false,
        },
        {
          name: "attributes",
          type: "{message}",
          optional: false,
        },
        {
          name: "note",
          type: "string",
          optional: false,
        },
        {
          name: "broadcast_channel_id",
          type: "uint64",
          optional: false,
        },
      ],
    },
    SetVirtualItemRewardDefinition: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "eventid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "action",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "itemsdefs[0]",
          type: "CVirtualItemRewardDefinition[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "eventid",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "item_bucket",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "active",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "rarity",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "package_to_grant",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "game_item_id",
              type: "fixed64",
              optional: true,
              description: "",
            },
            {
              name: "community_item_class",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "community_item_type",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "loyalty_point_type",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "amount",
              type: "int64",
              optional: true,
              description: "",
            },
            {
              name: "rtime_time_active",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "loyalty_reward_defid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "user_badge_to_grant",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "user_badge_level",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "virtual_item_def_id",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IRemoteClientService: {
    CancelPairing: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    CreateSession: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetReplies: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    NotifyRegisterStatusUpdate: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Register for status updates with a Steam client",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "device_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    NotifyRemotePacket: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Send a packet to a Steam client",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "payload",
          type: "bytes",
          optional: true,
          description: "",
        },
      ],
    },
    NotifyUnregisterStatusUpdate: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Unregister for status updates with a Steam client",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "session_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    SetPairingInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    StartPairing: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  ISaleFeatureService: {
    GetFriendsSharedYearInReview: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "return_private",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetUpdateProcessingProgress: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserActionData: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "type",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserSharingPermissions: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserYearAchievements: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "total_only",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserYearInReview: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "force_regenerate",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "access_source",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserYearInReviewShareImage: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserYearScreenshots: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetYIRCurrentMonthlySummary: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    SetUserActionData: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "gid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "jsondata",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SetUserSharingPermissions: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "year",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "privacy_state",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ISaleItemRewardsService: {
    CanClaimItem: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    ClaimItem: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetRewardDefinitions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "virtual_item_reward_event_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    SetRewardDefinitions: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "action",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "definitions[0]",
          type: "CSteamItemRewardDefinition[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_reward_def_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "virtual_item_reward_event_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_start_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_end_time",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IShoppingCartService: {
    AddBundle: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "bundleid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "browserid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "store_country",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "quantity",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "beta_mode",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    AddPackages: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "browserid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "store_country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "beta_mode",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "cart_items[0]",
          type: "CShoppingCart_PackageItem[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "costwhenadded",
              type: "CShoppingCart_Amount",
              optional: true,
              description: "",
              extra: [
                {
                  name: "amount",
                  type: "int64",
                  optional: true,
                  description: "",
                },
                {
                  name: "currencycode",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "is_gift",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "gidbundle",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "quantity",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    CreateNewShoppingCart: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid_requester",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "purchase_request_id",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    GetShoppingCartContents: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    RemoveLineItems: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "gidlineitems[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "browserid",
          type: "uint64",
          optional: true,
          description: "",
        },
      ],
    },
    UpdatePackageQuantity: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "gidshoppingcart",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "gidlineitem",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "quantity",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ISiteLicenseService: {
    GetCurrentClientConnections: {
      _type: "undocumented",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Steamworks Web API publisher authentication key",
        },
        {
          name: "siteid",
          type: "uint64",
          optional: true,
          description: "Site ID to see; zero for all sites",
        },
      ],
    },
    GetTotalPlaytime: {
      _type: "undocumented",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Steamworks Web API publisher authentication key",
        },
        {
          name: "start_time",
          type: "string",
          optional: false,
          description:
            "Report activity starting on or after this time. RFC 3339 UTC format.",
        },
        {
          name: "end_time",
          type: "string",
          optional: false,
          description:
            "Report activity starting before this time. RFC 3339 UTC format.",
        },
        {
          name: "siteid",
          type: "uint64",
          optional: true,
          description: "Site ID to see; zero for all sites",
        },
      ],
    },
  },
  ISteamApps: {
    GetAppBetas: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    GetAppBuilds: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "# of builds to retrieve (default 10)",
        },
        {
          name: "depot_details",
          type: "bool",
          optional: true,
          description:
            "True if we want the info on the depots in each build.  False if we don't need that info.  Defaults to true.",
        },
      ],
    },
    GetAppDepotVersions: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of depot",
        },
      ],
    },
    GetAppList: {
      version: 2,
      httpmethod: "GET",
      parameters: [],
    },
    GetCheatingReports: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "timebegin",
          type: "uint32",
          optional: false,
          description: "Time range begin",
        },
        {
          name: "timeend",
          type: "uint32",
          optional: false,
          description: "Time range end",
        },
        {
          name: "includereports",
          type: "bool",
          optional: false,
          description: "include reports that were not bans",
        },
        {
          name: "includebans",
          type: "bool",
          optional: false,
          description: "include reports that were bans",
        },
        {
          name: "reportidmin",
          type: "uint64",
          optional: true,
          description: "minimum report id",
        },
      ],
    },
    GetPartnerAppListForWebAPIKey: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "type_filter",
          type: "string",
          optional: true,
          description:
            "Filter app results by type. Can be comman separated, eg: games,dlc",
        },
      ],
    },
    GetPlayersBanned: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    GetSDRConfig: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    GetServerList: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "filter",
          type: "string",
          optional: true,
          description: "Query filter string",
        },
        {
          name: "limit",
          type: "uint32",
          optional: true,
          description: "Limit number of servers in the response",
        },
      ],
    },
    GetServersAtAddress: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "addr",
          type: "string",
          optional: false,
          description: "IP or IP:queryport to list",
        },
      ],
    },
    SetAppBuildLive: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "buildid",
          type: "uint32",
          optional: false,
          description: "BuildID",
        },
        {
          name: "betakey",
          type: "string",
          optional: false,
          description: "beta key, required. Use public for default branch",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "SteamID of user approving build change, required for public branches of released apps",
        },
        {
          name: "description",
          type: "string",
          optional: true,
          description: "optional description for this build",
        },
      ],
    },
    UpToDateCheck: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "version",
          type: "uint32",
          optional: false,
          description: "The installed version of the game",
        },
      ],
    },
    UpdateAppBranchDescription: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "betakey",
          type: "string",
          optional: false,
          description:
            "Beta branch name, required. Will not update default branch",
        },
        {
          name: "description",
          type: "string",
          optional: true,
          description: "Description for this beta branch, required",
        },
      ],
    },
  },
  ISteamAwardsService: {
    GetNominationRecommendations: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "category_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetNominationShareLink: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "generate_new",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserNominations: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    Nominate: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "category_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "nominated_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "write_in_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "store_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "rescind_nomination",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "source",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ISteamBitPay: {
    BitPayPaymentNotification: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [],
    },
  },
  ISteamBoaCompra: {
    BoaCompraCheckTransactionStatus: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [],
    },
  },
  ISteamBroadcast: {
    ViewerHeartbeat: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Steam ID of the broadcaster",
        },
        {
          name: "sessionid",
          type: "uint64",
          optional: false,
          description: "Broadcast Session ID",
        },
        {
          name: "token",
          type: "uint64",
          optional: false,
          description: "Viewer token",
        },
        {
          name: "stream",
          type: "int32",
          optional: true,
          description: "video stream representation watching",
        },
      ],
    },
  },
  ISteamCDN: {
    SetClientFilters: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "cdnname",
          type: "string",
          optional: false,
          description: "Steam name of CDN property",
        },
        {
          name: "allowedipblocks",
          type: "string",
          optional: true,
          description:
            "comma-separated list of allowed IP address blocks in CIDR format - blank for not used",
        },
        {
          name: "allowedasns",
          type: "string",
          optional: true,
          description:
            "comma-separated list of allowed client network AS numbers - blank for not used",
        },
        {
          name: "allowedipcountries",
          type: "string",
          optional: true,
          description:
            "comma-separated list of allowed client IP country codes in ISO 3166-1 format - blank for not used",
        },
      ],
    },
    SetPerformanceStats: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "cdnname",
          type: "string",
          optional: false,
          description: "Steam name of CDN property",
        },
        {
          name: "mbps_sent",
          type: "uint32",
          optional: true,
          description: "Outgoing network traffic in Mbps",
        },
        {
          name: "mbps_recv",
          type: "uint32",
          optional: true,
          description: "Incoming network traffic in Mbps",
        },
        {
          name: "cpu_percent",
          type: "uint32",
          optional: true,
          description: "Percent CPU load",
        },
        {
          name: "cache_hit_percent",
          type: "uint32",
          optional: true,
          description: "Percent cache hits",
        },
      ],
    },
  },
  ISteamChartsService: {
    GetBestOfYearPages: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetGamesByConcurrentPlayers: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetMostPlayedGames: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetMostPlayedSteamDeckGames: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "top_played_period",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTopReleasesPages: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
  },
  ISteamCloudGaming: {
    GetSupportedApps: {
      _type: "undocumented",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "platform",
          type: "string",
          optional: false,
          description: "Cloud gaming platform name",
        },
        {
          name: "detailed",
          type: "bool",
          optional: true,
          description: "Request extra details if supported",
        },
      ],
    },
  },
  ISteamCommunity: {
    ReportAbuse: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamidActor",
          type: "uint64",
          optional: false,
          description: "SteamID of user doing the reporting",
        },
        {
          name: "steamidTarget",
          type: "uint64",
          optional: false,
          description: "SteamID of the entity being accused of abuse",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID to check for ownership",
        },
        {
          name: "abuseType",
          type: "uint32",
          optional: false,
          description: "Abuse type code (see EAbuseReportType enum)",
        },
        {
          name: "contentType",
          type: "uint32",
          optional: false,
          description: "Content type code (see ECommunityContentType enum)",
        },
        {
          name: "description",
          type: "string",
          optional: false,
          description: "Narrative from user",
        },
        {
          name: "gid",
          type: "uint64",
          optional: true,
          description: "GID of related record (depends on content type)",
        },
      ],
    },
  },
  ISteamDirectory: {
    GetCMList: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "cellid",
          type: "uint32",
          optional: false,
          description: "Client's Steam cell ID",
        },
        {
          name: "maxcount",
          type: "uint32",
          optional: true,
          description: "Max number of servers to return",
        },
      ],
    },
    GetCMListForConnect: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "cellid",
          type: "uint32",
          optional: true,
          description: "Client's Steam cell ID, uses IP location if blank",
        },
        {
          name: "cmtype",
          type: "string",
          optional: true,
          description: "Optional CM type filter",
        },
        {
          name: "realm",
          type: "string",
          optional: true,
          description: "Optional Steam Realm filter",
        },
        {
          name: "maxcount",
          type: "uint32",
          optional: true,
          description: "Max number of servers to return",
        },
        {
          name: "qoslevel",
          type: "uint32",
          optional: true,
          description: "Desired connection priority",
        },
      ],
    },
    GetSteamPipeDomains: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  ISteamEconomy: {
    CanTrade: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description:
            "That the key is associated with. Must be a steam economy app.",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user attempting to initiate a trade",
        },
        {
          name: "targetid",
          type: "uint64",
          optional: false,
          description:
            "SteamID of user that is the target of the trade invitation",
        },
      ],
    },
    FinalizeAssetTransaction: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The app ID the user is buying assets for",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of the user making a purchase",
        },
        {
          name: "txnid",
          type: "string",
          optional: false,
          description: "The transaction ID",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "The local language for the user",
        },
      ],
    },
    GetAssetClassInfo: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "Must be a steam economy app.",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The user's local language",
        },
        {
          name: "class_count",
          type: "uint32",
          optional: false,
          description: "Number of classes requested. Must be at least one.",
        },
        {
          name: "classid0",
          type: "uint64",
          optional: false,
          description: "Class ID of the nth class.",
        },
        {
          name: "instanceid0",
          type: "uint64",
          optional: true,
          description: "Instance ID of the nth class.",
        },
      ],
    },
    GetAssetPrices: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "Must be a steam economy app.",
        },
        {
          name: "currency",
          type: "string",
          optional: true,
          description: "The currency to filter for",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "The user's local language",
        },
      ],
    },
    GetExportedAssetsForUser: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The app to get exported items from.",
        },
        {
          name: "contextid",
          type: "uint64",
          optional: false,
          description: "The context in the app to get exported items from.",
        },
      ],
    },
    GetMarketPrices: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "Must be a steam economy app.",
        },
      ],
    },
    StartAssetTransaction: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "The app ID the user is buying assets for",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user making a purchase",
        },
        {
          name: "assetid0",
          type: "string",
          optional: false,
          description:
            "The ID of the first asset the user is buying - there must be at least one",
        },
        {
          name: "assetquantity0",
          type: "uint32",
          optional: false,
          description: "The quantity of assetid0's the the user is buying",
        },
        {
          name: "currency",
          type: "string",
          optional: false,
          description: "The local currency for the user",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "The local language for the user",
        },
        {
          name: "ipaddress",
          type: "string",
          optional: false,
          description: "The user's IP address",
        },
        {
          name: "referrer",
          type: "string",
          optional: true,
          description: "The referring URL",
        },
        {
          name: "clientauth",
          type: "bool",
          optional: true,
          description:
            "If true (default is false), the authorization will appear in the user's steam client overlay, rather than as a web page - useful for stores that are embedded in products.",
        },
      ],
    },
    StartTrade: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description:
            "That the key is associated with. Must be a steam economy app.",
        },
        {
          name: "partya",
          type: "uint64",
          optional: false,
          description: "SteamID of first user in the trade",
        },
        {
          name: "partyb",
          type: "uint64",
          optional: false,
          description: "SteamID of second user in the trade",
        },
      ],
    },
  },
  ISteamEnvoy: {
    PaymentOutReversalNotification: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [],
    },
  },
  ISteamGameServerStats: {
    GetGameServerPlayerStatsForGame: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "gameid",
          type: "uint64",
          optional: false,
          description:
            "game id to get stats for, if not a mod, it's safe to use appid here",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of the game",
        },
        {
          name: "rangestart",
          type: "string",
          optional: false,
          description:
            "range start date/time (Format: YYYY-MM-DD HH:MM:SS, seattle local time",
        },
        {
          name: "rangeend",
          type: "string",
          optional: false,
          description:
            "range end date/time (Format: YYYY-MM-DD HH:MM:SS, seattle local time",
        },
        {
          name: "maxresults",
          type: "uint32",
          optional: true,
          description: "Max number of results to return (up to 1000)",
        },
      ],
    },
  },
  ISteamLeaderboards: {
    DeleteLeaderboard: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "name",
          type: "string",
          optional: false,
          description: "name of the leaderboard to delete",
        },
      ],
    },
    DeleteLeaderboardScore: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "leaderboardid",
          type: "uint64",
          optional: false,
          description:
            "numeric ID of the target leaderboard. Can be retrieved from GetLeaderboardsForGame",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamID to set the score for",
        },
      ],
    },
    FindOrCreateLeaderboard: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "name",
          type: "string",
          optional: false,
          description: "name of the leaderboard to create",
        },
        {
          name: "sortmethod",
          type: "string",
          optional: true,
          description:
            "sort method to use for this leaderboard (defaults to Ascending)",
        },
        {
          name: "displaytype",
          type: "string",
          optional: true,
          description:
            "display type for this leaderboard (defaults to Numeric)",
        },
        {
          name: "createifnotfound",
          type: "bool",
          optional: true,
          description:
            "if this is true the leaderboard will be created if it doesn't exist. Defaults to true.",
        },
        {
          name: "onlytrustedwrites",
          type: "bool",
          optional: true,
          description:
            "if this is true the leaderboard scores cannot be set by clients, and can only be set by publisher via SetLeaderboardScore WebAPI. Defaults to false.",
        },
        {
          name: "onlyfriendsreads",
          type: "bool",
          optional: true,
          description:
            "if this is true the leaderboard scores can only be read for friends by clients, scores can always be read by publisher. Defaults to false.",
        },
        {
          name: "onlyusersinsameparty",
          type: "bool",
          optional: true,
          description:
            "if this is true the leaderboard scores for SteamIDs can only be read for party members, scores can always be read by publisher. Defaults to false.",
        },
        {
          name: "limitrangearounduser",
          type: "int32",
          optional: true,
          description:
            "limit the range of rows around user. Zero means unlimited. -1 means disabled. Positive is plus/minus limit. Defaults to zero.",
        },
        {
          name: "limitglobaltopentries",
          type: "int32",
          optional: true,
          description:
            "limit the top of the leaderboard. Zero means unlimited. -1 means disabled. Positive is limit to TOP(N). Defaults to zero.",
        },
      ],
    },
    GetLeaderboardEntries: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "rangestart",
          type: "int32",
          optional: false,
          description: "range start or 0",
        },
        {
          name: "rangeend",
          type: "int32",
          optional: false,
          description: "range end or max LB entries",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "SteamID used for friend & around user requests",
        },
        {
          name: "leaderboardid",
          type: "int32",
          optional: false,
          description: "ID of the leaderboard to view",
        },
        {
          name: "datarequest",
          type: "uint32",
          optional: false,
          description:
            "type of request: RequestGlobal, RequestAroundUser, RequestFriends",
        },
      ],
    },
    GetLeaderboardsForGame: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
      ],
    },
    ModifyLeaderboardScoreMulti: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamID to set the score for",
        },
        {
          name: "score",
          type: "int32",
          optional: true,
          description: "the score to set for this user",
        },
        {
          name: "scoremethod",
          type: "string",
          optional: true,
          description:
            'update method to use. Can be "KeepBest" or "ForceUpdate"',
        },
        {
          name: "details",
          type: "rawbinary",
          optional: true,
          description:
            "game-specific details for how the score was earned. Up to 256 bytes.",
        },
        {
          name: "leaderboardid_del[0]",
          type: "uint32[]",
          optional: true,
          description:
            "Numeric ID of the target leaderboard to delete user scores from. Multiple leaderboards supported by numbering sequentially [0], [1], [2], ... Leaderboards be retrieved from GetLeaderboardsForGame.",
        },
        {
          name: "leaderboardid_del[1]",
          type: "uint32",
          optional: true,
          description:
            "Numeric ID of the target leaderboard to delete user scores from. Multiple leaderboards supported by numbering sequentially [0], [1], [2], ... Leaderboards be retrieved from GetLeaderboardsForGame.",
        },
        {
          name: "leaderboardid_set[0]",
          type: "uint32[]",
          optional: true,
          description:
            "Numeric ID of the target leaderboard to set user scores into. Multiple leaderboards supported by numbering sequentially [0], [1], [2], ... Scores are set after all delete operations complete. Leaderboards be retrieved from GetLeaderboardsForGame.",
        },
        {
          name: "leaderboardid_set[1]",
          type: "uint32",
          optional: true,
          description:
            "Numeric ID of the target leaderboard to set user scores into. Multiple leaderboards supported by numbering sequentially [0], [1], [2], ... Scores are set after all delete operations complete. Leaderboards be retrieved from GetLeaderboardsForGame.",
        },
      ],
    },
    ResetLeaderboard: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "leaderboardid",
          type: "uint32",
          optional: false,
          description:
            "numeric ID of the target leaderboard. Can be retrieved from GetLeaderboardsForGame",
        },
      ],
    },
    SetLeaderboardScore: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "leaderboardid",
          type: "uint32",
          optional: false,
          description:
            "numeric ID of the target leaderboard. Can be retrieved from GetLeaderboardsForGame",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "steamID to set the score for",
        },
        {
          name: "score",
          type: "int32",
          optional: false,
          description: "the score to set for this user",
        },
        {
          name: "scoremethod",
          type: "string",
          optional: false,
          description:
            'update method to use. Can be "KeepBest" or "ForceUpdate"',
        },
        {
          name: "details",
          type: "rawbinary",
          optional: true,
          description:
            "game-specific details for how the score was earned. Up to 256 bytes.",
        },
      ],
    },
  },
  ISteamLearnService: {
    BatchOperation: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Batches multiple data updates, snapshots, and inference requests into a single call",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "snapshot_requests",
          type: "CMsgSteamLearn_SnapshotProject_Request",
          optional: true,
          description: "",
        },
        {
          name: "inference_requests",
          type: "CMsgSteamLearn_Inference_Request",
          optional: true,
          description: "",
        },
        {
          name: "cache_data_requests[0]",
          type: "CMsgSteamLearn_CacheData_Request[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "access_token",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "data",
              type: "CMsgSteamLearnData",
              optional: true,
              description: "",
              extra: [
                {
                  name: "data_source_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "keys[0]",
                  type: "uint64[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_object",
                  type: "CMsgSteamLearnDataObject",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "elements[0]",
                      type: "CMsgSteamLearnDataElement[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_int32s[0]",
                          type: "int32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_floats[0]",
                          type: "float[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_bools[0]",
                          type: "bool[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_strings[0]",
                          type: "string[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_objects[0]",
                          type: "CMsgSteamLearnDataObject[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "elements[0]",
                              type: "CMsgSteamLearnDataElement[]",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: "snapshot_requests[0]",
          type: "CMsgSteamLearn_SnapshotProject_Request[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "access_token",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "project_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "published_version",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "keys[0]",
              type: "uint64[]",
              optional: true,
              description: "",
            },
            {
              name: "data[0]",
              type: "CMsgSteamLearnData[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "data_source_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "keys[0]",
                  type: "uint64[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_object",
                  type: "CMsgSteamLearnDataObject",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "elements[0]",
                      type: "CMsgSteamLearnDataElement[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_int32s[0]",
                          type: "int32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_floats[0]",
                          type: "float[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_bools[0]",
                          type: "bool[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_strings[0]",
                          type: "string[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_objects[0]",
                          type: "CMsgSteamLearnDataObject[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "elements[0]",
                              type: "CMsgSteamLearnDataElement[]",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: "pending_data_limit_seconds",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "inference_requests[0]",
          type: "CMsgSteamLearn_Inference_Request[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "access_token",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "project_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "published_version",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "override_train_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "data",
              type: "CMsgSteamLearnDataList",
              optional: true,
              description: "",
              extra: [
                {
                  name: "data[0]",
                  type: "CMsgSteamLearnData[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "data_source_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "keys[0]",
                      type: "uint64[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_object",
                      type: "CMsgSteamLearnDataObject",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "elements[0]",
                          type: "CMsgSteamLearnDataElement[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "name",
                              type: "string",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_int32s[0]",
                              type: "int32[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_floats[0]",
                              type: "float[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_bools[0]",
                              type: "bool[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_strings[0]",
                              type: "string[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_objects[0]",
                              type: "CMsgSteamLearnDataObject[]",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: "additional_data[0]",
              type: "float[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    CacheData: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Updates a cached data entry.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "access_token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "access_data",
          type: "CMsgSteamLearn_AccessData",
          optional: true,
          description: "",
          extra: [
            {
              name: "publisher_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "timestamp",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "random_value",
              type: "uint64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data",
          type: "CMsgSteamLearnData",
          optional: true,
          description: "",
          extra: [
            {
              name: "data_source_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "keys[0]",
              type: "uint64[]",
              optional: true,
              description: "",
            },
            {
              name: "data_object",
              type: "CMsgSteamLearnDataObject",
              optional: true,
              description: "",
              extra: [
                {
                  name: "elements[0]",
                  type: "CMsgSteamLearnDataElement[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_int32s[0]",
                      type: "int32[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_floats[0]",
                      type: "float[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_bools[0]",
                      type: "bool[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_strings[0]",
                      type: "string[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_objects[0]",
                      type: "CMsgSteamLearnDataObject[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "elements[0]",
                          type: "CMsgSteamLearnDataElement[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "name",
                              type: "string",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_int32s[0]",
                              type: "int32[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_floats[0]",
                              type: "float[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_bools[0]",
                              type: "bool[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_strings[0]",
                              type: "string[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_objects[0]",
                              type: "CMsgSteamLearnDataObject[]",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    CreateProject: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "project_description",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    EditProject: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project",
          type: "CMsgSteamLearnProject",
          optional: true,
          description: "",
          extra: [
            {
              name: "project_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "project_name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "project_description",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "creator_account_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "create_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "unpublished_config",
              type: "CMsgSteamLearnProjectConfig",
              optional: true,
              description: "",
              extra: [
                {
                  name: "project_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "publish_time",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "published_version",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_source_ids[0]",
                  type: "uint32[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_source_element_usages[0]",
                  type: "CMsgSteamLearnDataSourceElementUsage[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "data_source_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_element_path",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "is_string",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "input",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sql_column",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "preprocessing_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "min_range",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "max_range",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "std_dev",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_table_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sort_sequence",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_min_length",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "project_nodes[0]",
                  type: "CMsgSteamLearnProjectNode[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "node_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "location_x",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "location_y",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "comment",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "connectors[0]",
                      type: "CMsgSteamLearnProjectNodeConnector[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "connector_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "linked_connector_ids[0]",
                          type: "uint32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "is_input_connector",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "input",
                      type: "CMsgSteamLearnModelNodeInput",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "input_num",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dense",
                      type: "CMsgSteamLearnModelNodeDense",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "regularization",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dense_stack",
                      type: "CMsgSteamLearnModelNodeDenseStack",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width[0]",
                          type: "uint32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "dropout_pct",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "regularization",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dropout",
                      type: "CMsgSteamLearnModelNodeDropout",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "dropout_pct",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "embedding",
                      type: "CMsgSteamLearnModelNodeEmbedding",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "max_value",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "embedding_width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "flatten",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "export_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "embed_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "train",
                      type: "CMsgSteamLearnModelNodeTrain",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "input_count",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "loss",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "learning_rate",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "conditional_extract",
                      type: "CMsgSteamLearnModelNodeConditionalExtract",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "extract_filter_type",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "extract_weight_type",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "filter_info",
                          type: "CMsgSteamLearnModelNodeConditionalExtract_FilterInfo",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "appid_release_recency_months",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "appid_publisher_id",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "appid_featured_tag_id",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "appid_theme_tag_id",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                        {
                          name: "weight_info",
                          type: "CMsgSteamLearnModelNodeConditionalExtract_WeightInfo",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "appid_release_recency_bias",
                              type: "float",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "input_number",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "input_strength",
                              type: "float",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "extracted_compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "concatenate",
                      type: "CMsgSteamLearnModelNodeConcatenate",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "axis",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "shuffle",
                      type: "CMsgSteamLearnModelNodeShuffle",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "exclude_zeroes",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "synced_shuffle",
                      type: "CMsgSteamLearnModelNodeSyncedShuffle",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "exclude_zeroes",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "onehot",
                      type: "CMsgSteamLearnModelNodeOnehot",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "multi_hot",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "explode",
                      type: "CMsgSteamLearnModelNodeExplode",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "conditional_swap",
                      type: "CMsgSteamLearnModelNodeConditionalSwap",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "kmeans",
                      type: "CMsgSteamLearnModelNodeKMeansCluster",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "num_clusters",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "generate_clusters",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "combine",
                      type: "CMsgSteamLearnModelNodeCombine",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "text_vectorization",
                      type: "CMsgSteamLearnModelNodeTextVectorization",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "vocabulary_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "standardize",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "output",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "sequence_length",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "split",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "ngrams",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "batch_normalization",
                      type: "CMsgSteamLearnModelNodeBatchNormalization",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "normalize",
                      type: "CMsgSteamLearnModelNodeNormalize",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "named_inference",
                      type: "CMsgSteamLearnModelNodeNamedInference",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "only_inference",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dot",
                      type: "CMsgSteamLearnModelNodeDot",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "normalize",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "extract",
                      type: "CMsgSteamLearnModelNodeExtract",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "input_type",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "mode",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "exclusion",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "selection",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "bias_start",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "bias_end",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "input_bias_input_number",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "input_bias_strength",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "positive_sample_percent",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "extracted_compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "recency_months",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "conv_1d",
                      type: "CMsgSteamLearnModelNodeConv1D",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "filters",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "kernel_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "strides",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "max_pooling_1d",
                      type: "CMsgSteamLearnModelNodeMaxPooling1D",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "pool_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "strides",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "flatten",
                      type: "CMsgSteamLearnModelNodeFlatten",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "global_max_pooling",
                      type: "CMsgSteamLearnModelNodeGlobalMaxPooling1D",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "transformer",
                      type: "CMsgSteamLearnModelNodeTransformer",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "num_heads",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "feedforward_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "dropout_pct",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "num_internal_blocks",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "regularization",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "external_embedding",
                      type: "CMsgSteamLearnModelNodeExternalEmbedding",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "project_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "published_version",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "embedding_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "time_distributed_dense",
                      type: "CMsgSteamLearnModelNodeTimeDistributedDense",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "sequence_split",
                      type: "CMsgSteamLearnModelNodeSequenceSplit",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "head_split_chance",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "mid_split_chance",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "tail_split_chance",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "sequence_table_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "weighted_average",
                      type: "CMsgSteamLearnModelNodeWeightedAverage",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "axis",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "use_weights",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "global_avg_pooling_1d",
                      type: "CMsgSteamLearnModelNodeGlobalAvgPooling1D",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "snapshot_config",
                  type: "CMsgSteamLearnProjectSnapshotConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "snapshot_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "config_account_ids",
                      type: "CMsgSteamLearnProjectSnapshotConfigAccountIDs",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "percent",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "activity_recency_days",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "filter",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "config_app_ids",
                      type: "CMsgSteamLearnProjectSnapshotConfigAppIDs",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "percent",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "release_recency_days",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "config_other_project",
                      type: "CMsgSteamLearnProjectSnapshotConfigOtherProject",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "project_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "published_version",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "snapshot_schedule_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "snapshot_schedule_day_of_week",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "snapshot_schedule_day_of_month",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compress",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "job_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "snapshot_schedule_hour_of_day",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "train_config",
                  type: "CMsgSteamLearnTrainConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "fetch_workers",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "fetch_chunk_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_batch_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_epoch_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_loss_improvement_threshold",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_no_loss_improvement_epoch_limit",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_optimizer",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_learning_rate",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_gpu",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "snapshot_filter",
                  type: "CMsgSteamLearnProjectSnapshotFilter",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "sample_reduce_percent",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "histogram",
                      type: "CMsgSteamLearnProjectSnapshotFilterHistogram",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "data_element_path",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "min_value",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "max_value",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "num_buckets",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "map_data_element_sql_column[0]",
                  type: "CMsgSteamLearnProjectConfig_MapDataElementSqlColumnEntry[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "key",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "value",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "total_sql_columns",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_retention_config",
                  type: "CMsgSteamLearnDataRetentionConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "snapshot_keep_duration_days",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "fetch_keep_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "scheduled_train_config",
                  type: "CMsgSteamLearnScheduledTrainConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "scheduled_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_minute",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_hour",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_day_of_week",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_day_of_month",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "auto_activate_accuracy_threshold",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "fetch_infos[0]",
                  type: "CMsgSteamLearnFetchInfo[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "fetch_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "train_infos[0]",
                  type: "CMsgSteamLearnTrainInfo[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "fetch_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_train",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "auto_snapshot_pending",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "published_configs[0]",
              type: "CMsgSteamLearnProjectConfig[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "project_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "publish_time",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "published_version",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_source_ids[0]",
                  type: "uint32[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_source_element_usages[0]",
                  type: "CMsgSteamLearnDataSourceElementUsage[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "data_source_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_element_path",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "is_string",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "input",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sql_column",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "preprocessing_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "min_range",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "max_range",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "std_dev",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_table_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sort_sequence",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_min_length",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "project_nodes[0]",
                  type: "CMsgSteamLearnProjectNode[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "node_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "location_x",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "location_y",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "comment",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "connectors[0]",
                      type: "CMsgSteamLearnProjectNodeConnector[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "connector_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "linked_connector_ids[0]",
                          type: "uint32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "is_input_connector",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "input",
                      type: "CMsgSteamLearnModelNodeInput",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "input_num",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dense",
                      type: "CMsgSteamLearnModelNodeDense",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "regularization",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dense_stack",
                      type: "CMsgSteamLearnModelNodeDenseStack",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width[0]",
                          type: "uint32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "dropout_pct",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "regularization",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dropout",
                      type: "CMsgSteamLearnModelNodeDropout",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "dropout_pct",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "embedding",
                      type: "CMsgSteamLearnModelNodeEmbedding",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "max_value",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "embedding_width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "flatten",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "export_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "embed_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "train",
                      type: "CMsgSteamLearnModelNodeTrain",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "input_count",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "loss",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "learning_rate",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "conditional_extract",
                      type: "CMsgSteamLearnModelNodeConditionalExtract",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "extract_filter_type",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "extract_weight_type",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "filter_info",
                          type: "CMsgSteamLearnModelNodeConditionalExtract_FilterInfo",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "appid_release_recency_months",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "appid_publisher_id",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "appid_featured_tag_id",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "appid_theme_tag_id",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                        {
                          name: "weight_info",
                          type: "CMsgSteamLearnModelNodeConditionalExtract_WeightInfo",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "appid_release_recency_bias",
                              type: "float",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "input_number",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "input_strength",
                              type: "float",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "extracted_compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "concatenate",
                      type: "CMsgSteamLearnModelNodeConcatenate",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "axis",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "shuffle",
                      type: "CMsgSteamLearnModelNodeShuffle",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "exclude_zeroes",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "synced_shuffle",
                      type: "CMsgSteamLearnModelNodeSyncedShuffle",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "exclude_zeroes",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "onehot",
                      type: "CMsgSteamLearnModelNodeOnehot",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "multi_hot",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "explode",
                      type: "CMsgSteamLearnModelNodeExplode",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "conditional_swap",
                      type: "CMsgSteamLearnModelNodeConditionalSwap",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "kmeans",
                      type: "CMsgSteamLearnModelNodeKMeansCluster",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "num_clusters",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "generate_clusters",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "combine",
                      type: "CMsgSteamLearnModelNodeCombine",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "text_vectorization",
                      type: "CMsgSteamLearnModelNodeTextVectorization",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "vocabulary_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "standardize",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "output",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "sequence_length",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "split",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "ngrams",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "batch_normalization",
                      type: "CMsgSteamLearnModelNodeBatchNormalization",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "normalize",
                      type: "CMsgSteamLearnModelNodeNormalize",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "named_inference",
                      type: "CMsgSteamLearnModelNodeNamedInference",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "only_inference",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "dot",
                      type: "CMsgSteamLearnModelNodeDot",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "normalize",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "extract",
                      type: "CMsgSteamLearnModelNodeExtract",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "input_type",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "mode",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "exclusion",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "selection",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "bias_start",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "bias_end",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "input_bias_input_number",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "input_bias_strength",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "positive_sample_percent",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "extracted_compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "recency_months",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "conv_1d",
                      type: "CMsgSteamLearnModelNodeConv1D",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "filters",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "kernel_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "strides",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "max_pooling_1d",
                      type: "CMsgSteamLearnModelNodeMaxPooling1D",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "pool_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "strides",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "flatten",
                      type: "CMsgSteamLearnModelNodeFlatten",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "global_max_pooling",
                      type: "CMsgSteamLearnModelNodeGlobalMaxPooling1D",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "transformer",
                      type: "CMsgSteamLearnModelNodeTransformer",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "num_heads",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "feedforward_size",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "dropout_pct",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "num_internal_blocks",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "regularization",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "external_embedding",
                      type: "CMsgSteamLearnModelNodeExternalEmbedding",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "project_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "published_version",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "embedding_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "time_distributed_dense",
                      type: "CMsgSteamLearnModelNodeTimeDistributedDense",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "activation",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "width",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "sequence_split",
                      type: "CMsgSteamLearnModelNodeSequenceSplit",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "head_split_chance",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "mid_split_chance",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "tail_split_chance",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "sequence_table_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "compact_table_name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "weighted_average",
                      type: "CMsgSteamLearnModelNodeWeightedAverage",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "axis",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "use_weights",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "global_avg_pooling_1d",
                      type: "CMsgSteamLearnModelNodeGlobalAvgPooling1D",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "snapshot_config",
                  type: "CMsgSteamLearnProjectSnapshotConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "snapshot_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "config_account_ids",
                      type: "CMsgSteamLearnProjectSnapshotConfigAccountIDs",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "percent",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "activity_recency_days",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "filter",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "config_app_ids",
                      type: "CMsgSteamLearnProjectSnapshotConfigAppIDs",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "percent",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "release_recency_days",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "config_other_project",
                      type: "CMsgSteamLearnProjectSnapshotConfigOtherProject",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "project_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "published_version",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "snapshot_schedule_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "snapshot_schedule_day_of_week",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "snapshot_schedule_day_of_month",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compress",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "job_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "snapshot_schedule_hour_of_day",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "train_config",
                  type: "CMsgSteamLearnTrainConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "fetch_workers",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "fetch_chunk_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_batch_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_epoch_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_loss_improvement_threshold",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_no_loss_improvement_epoch_limit",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_optimizer",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_learning_rate",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_gpu",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "snapshot_filter",
                  type: "CMsgSteamLearnProjectSnapshotFilter",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "sample_reduce_percent",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "histogram",
                      type: "CMsgSteamLearnProjectSnapshotFilterHistogram",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "data_element_path",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "min_value",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "max_value",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "num_buckets",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "map_data_element_sql_column[0]",
                  type: "CMsgSteamLearnProjectConfig_MapDataElementSqlColumnEntry[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "key",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "value",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "total_sql_columns",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_retention_config",
                  type: "CMsgSteamLearnDataRetentionConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "snapshot_keep_duration_days",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "fetch_keep_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "scheduled_train_config",
                  type: "CMsgSteamLearnScheduledTrainConfig",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "scheduled_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_minute",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_hour",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_day_of_week",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_day_of_month",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "auto_activate_accuracy_threshold",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "fetch_infos[0]",
                  type: "CMsgSteamLearnFetchInfo[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "fetch_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "train_infos[0]",
                  type: "CMsgSteamLearnTrainInfo[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "fetch_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "train_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "scheduled_train",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "auto_snapshot_pending",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetAccessTokens: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets the access tokens needed for registering data sources, submitting data to them, and snapshotting projects",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetAccessTokensWeb: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetBatchedStatus: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "fetch_requests[0]",
          type: "CMsgSteamLearn_GetFetchStatus_Request[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "project_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "fetch_id",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "train_requests[0]",
          type: "CMsgSteamLearn_GetTrainStatus_Request[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "project_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "train_id",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetDataSource: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "data_source_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetEmbeddingValues: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "export_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "numerical_values[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "fetch_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetFetchStatus: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "fetch_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetFetchStatusVersions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetHMACKeys: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets the HMAC keys needed for registering data sources, submitting data to them, and snapshotting projects",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetLogEvents: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "look_behind_days",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "look_ahead_days",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "start_timestamp",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "end_timestamp",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetNearestEmbedding: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "export_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "result_count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "values[0]",
          type: "float[]",
          optional: true,
          description: "",
        },
        {
          name: "fetch_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "popularity_weight",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "focus_weight",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetProject: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTrainLogs: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "fetch_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTrainStatus: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetTrainStatusVersions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    Inference: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Inferences using supplied data, or data associated with the specified key.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "access_token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "access_data",
          type: "CMsgSteamLearn_AccessData",
          optional: true,
          description: "",
          extra: [
            {
              name: "publisher_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "timestamp",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "random_value",
              type: "uint64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "override_train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "data",
          type: "CMsgSteamLearnDataList",
          optional: true,
          description: "",
          extra: [
            {
              name: "data[0]",
              type: "CMsgSteamLearnData[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "data_source_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "keys[0]",
                  type: "uint64[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_object",
                  type: "CMsgSteamLearnDataObject",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "elements[0]",
                      type: "CMsgSteamLearnDataElement[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_int32s[0]",
                          type: "int32[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_floats[0]",
                          type: "float[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_bools[0]",
                          type: "bool[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_strings[0]",
                          type: "string[]",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "data_objects[0]",
                          type: "CMsgSteamLearnDataObject[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "elements[0]",
                              type: "CMsgSteamLearnDataElement[]",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: "additional_data[0]",
          type: "float[]",
          optional: true,
          description: "",
        },
        {
          name: "keys[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "named_inference",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    InferenceBackend: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "fetch_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "additional_data[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "keys[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "data[0]",
          type: "CMsgSteamLearnRawDataElement[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "float_value",
              type: "float",
              optional: true,
              description: "",
            },
            {
              name: "string_value",
              type: "string",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "named_inference",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    InferenceMetadata: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Requests the metadata that was generated from a specified fetch.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "access_token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "access_data",
          type: "CMsgSteamLearn_AccessData",
          optional: true,
          description: "",
          extra: [
            {
              name: "publisher_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "timestamp",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "random_value",
              type: "uint64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "override_train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    ListDataSources: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    ListProjects: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    PublishProject: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    RegisterDataSource: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Registers a data desc (or finds a data desc if it's already registered).",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "access_token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "access_data",
          type: "CMsgSteamLearn_AccessData",
          optional: true,
          description: "",
          extra: [
            {
              name: "publisher_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "timestamp",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "random_value",
              type: "uint64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_source",
          type: "CMsgSteamLearnDataSource",
          optional: true,
          description: "",
          extra: [
            {
              name: "id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "name",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "version",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "source_description",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "structure",
              type: "CMsgSteamLearnDataSourceDescObject",
              optional: true,
              description: "",
              extra: [
                {
                  name: "elements[0]",
                  type: "CMsgSteamLearnDataSourceDescElement[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_type",
                      type: "ESteamLearnDataType",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "object",
                      type: "CMsgSteamLearnDataSourceDescObject",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "elements[0]",
                          type: "CMsgSteamLearnDataSourceDescElement[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "name",
                              type: "string",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_type",
                              type: "ESteamLearnDataType",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "object",
                              type: "CMsgSteamLearnDataSourceDescObject",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "count",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                    {
                      name: "count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "structure_crc",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "cache_duration_seconds",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    SetTrainLive: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "train_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "from_scheduled",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "deactivate",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SnapshotProject: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Snapshots the current data for a project.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "access_token",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "access_data",
          type: "CMsgSteamLearn_AccessData",
          optional: true,
          description: "",
          extra: [
            {
              name: "publisher_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "timestamp",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "random_value",
              type: "uint64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "project_id",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "published_version",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "keys[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "data",
          type: "CMsgSteamLearnData",
          optional: true,
          description: "",
        },
        {
          name: "pending_data_limit_seconds",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "data[0]",
          type: "CMsgSteamLearnData[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "data_source_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "keys[0]",
              type: "uint64[]",
              optional: true,
              description: "",
            },
            {
              name: "data_object",
              type: "CMsgSteamLearnDataObject",
              optional: true,
              description: "",
              extra: [
                {
                  name: "elements[0]",
                  type: "CMsgSteamLearnDataElement[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_int32s[0]",
                      type: "int32[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_floats[0]",
                      type: "float[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_bools[0]",
                      type: "bool[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_strings[0]",
                      type: "string[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "data_objects[0]",
                      type: "CMsgSteamLearnDataObject[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "elements[0]",
                          type: "CMsgSteamLearnDataElement[]",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "name",
                              type: "string",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_int32s[0]",
                              type: "int32[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_floats[0]",
                              type: "float[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_bools[0]",
                              type: "bool[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_strings[0]",
                              type: "string[]",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "data_objects[0]",
                              type: "CMsgSteamLearnDataObject[]",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    Train: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "project_config",
          type: "CMsgSteamLearnProjectConfig",
          optional: true,
          description: "",
          extra: [
            {
              name: "project_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "publish_time",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "published_version",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "data_source_ids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "data_source_element_usages[0]",
              type: "CMsgSteamLearnDataSourceElementUsage[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "data_source_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "data_element_path",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "is_string",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "input",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "sql_column",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "preprocessing_type",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "min_range",
                  type: "float",
                  optional: true,
                  description: "",
                },
                {
                  name: "max_range",
                  type: "float",
                  optional: true,
                  description: "",
                },
                {
                  name: "std_dev",
                  type: "float",
                  optional: true,
                  description: "",
                },
                {
                  name: "compact_table",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "compact_table_count",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "sequence_table",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "sequence_table_count",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "sort_sequence",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "sequence_min_length",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "project_nodes[0]",
              type: "CMsgSteamLearnProjectNode[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "node_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "location_x",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "location_y",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "comment",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "type",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "connectors[0]",
                  type: "CMsgSteamLearnProjectNodeConnector[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "connector_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "linked_connector_ids[0]",
                      type: "uint32[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "is_input_connector",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "input",
                  type: "CMsgSteamLearnModelNodeInput",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "input_num",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "dense",
                  type: "CMsgSteamLearnModelNodeDense",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "activation",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "width",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "regularization",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "dense_stack",
                  type: "CMsgSteamLearnModelNodeDenseStack",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "activation",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "width[0]",
                      type: "uint32[]",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "dropout_pct",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "regularization",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "dropout",
                  type: "CMsgSteamLearnModelNodeDropout",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "dropout_pct",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "embedding",
                  type: "CMsgSteamLearnModelNodeEmbedding",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "max_value",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "embedding_width",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "flatten",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "export_name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "embed_name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "train",
                  type: "CMsgSteamLearnModelNodeTrain",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "input_count",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "activation",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "width",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "loss",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "learning_rate",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "conditional_extract",
                  type: "CMsgSteamLearnModelNodeConditionalExtract",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "extract_filter_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "extract_weight_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "filter_info",
                      type: "CMsgSteamLearnModelNodeConditionalExtract_FilterInfo",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "appid_release_recency_months",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "appid_publisher_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "appid_featured_tag_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "appid_theme_tag_id",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "weight_info",
                      type: "CMsgSteamLearnModelNodeConditionalExtract_WeightInfo",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "appid_release_recency_bias",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "input_number",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "input_strength",
                          type: "float",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "extracted_compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "concatenate",
                  type: "CMsgSteamLearnModelNodeConcatenate",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "axis",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "shuffle",
                  type: "CMsgSteamLearnModelNodeShuffle",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "exclude_zeroes",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "synced_shuffle",
                  type: "CMsgSteamLearnModelNodeSyncedShuffle",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "exclude_zeroes",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "onehot",
                  type: "CMsgSteamLearnModelNodeOnehot",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "width",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "multi_hot",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "explode",
                  type: "CMsgSteamLearnModelNodeExplode",
                  optional: true,
                  description: "",
                },
                {
                  name: "conditional_swap",
                  type: "CMsgSteamLearnModelNodeConditionalSwap",
                  optional: true,
                  description: "",
                },
                {
                  name: "kmeans",
                  type: "CMsgSteamLearnModelNodeKMeansCluster",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "num_clusters",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "generate_clusters",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "combine",
                  type: "CMsgSteamLearnModelNodeCombine",
                  optional: true,
                  description: "",
                },
                {
                  name: "text_vectorization",
                  type: "CMsgSteamLearnModelNodeTextVectorization",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "vocabulary_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "standardize",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "output",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_length",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "split",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "ngrams",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "batch_normalization",
                  type: "CMsgSteamLearnModelNodeBatchNormalization",
                  optional: true,
                  description: "",
                },
                {
                  name: "normalize",
                  type: "CMsgSteamLearnModelNodeNormalize",
                  optional: true,
                  description: "",
                },
                {
                  name: "named_inference",
                  type: "CMsgSteamLearnModelNodeNamedInference",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "only_inference",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "dot",
                  type: "CMsgSteamLearnModelNodeDot",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "normalize",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "extract",
                  type: "CMsgSteamLearnModelNodeExtract",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "input_type",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "mode",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "exclusion",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "selection",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "bias_start",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "bias_end",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "input_bias_input_number",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "input_bias_strength",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "positive_sample_percent",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "extracted_compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "recency_months",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "conv_1d",
                  type: "CMsgSteamLearnModelNodeConv1D",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "filters",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "kernel_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "strides",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "activation",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "max_pooling_1d",
                  type: "CMsgSteamLearnModelNodeMaxPooling1D",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "pool_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "strides",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "flatten",
                  type: "CMsgSteamLearnModelNodeFlatten",
                  optional: true,
                  description: "",
                },
                {
                  name: "global_max_pooling",
                  type: "CMsgSteamLearnModelNodeGlobalMaxPooling1D",
                  optional: true,
                  description: "",
                },
                {
                  name: "transformer",
                  type: "CMsgSteamLearnModelNodeTransformer",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "num_heads",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "feedforward_size",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "dropout_pct",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "num_internal_blocks",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "regularization",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "external_embedding",
                  type: "CMsgSteamLearnModelNodeExternalEmbedding",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "project_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "published_version",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "embedding_name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "time_distributed_dense",
                  type: "CMsgSteamLearnModelNodeTimeDistributedDense",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "activation",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "width",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "sequence_split",
                  type: "CMsgSteamLearnModelNodeSequenceSplit",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "head_split_chance",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "mid_split_chance",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "tail_split_chance",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "sequence_table_name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "compact_table_name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "weighted_average",
                  type: "CMsgSteamLearnModelNodeWeightedAverage",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "axis",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "use_weights",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "global_avg_pooling_1d",
                  type: "CMsgSteamLearnModelNodeGlobalAvgPooling1D",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "snapshot_config",
              type: "CMsgSteamLearnProjectSnapshotConfig",
              optional: true,
              description: "",
              extra: [
                {
                  name: "snapshot_type",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "config_account_ids",
                  type: "CMsgSteamLearnProjectSnapshotConfigAccountIDs",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "percent",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "activity_recency_days",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "filter",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "config_app_ids",
                  type: "CMsgSteamLearnProjectSnapshotConfigAppIDs",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "percent",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "release_recency_days",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "config_other_project",
                  type: "CMsgSteamLearnProjectSnapshotConfigOtherProject",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "project_id",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "published_version",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "snapshot_schedule_type",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "snapshot_schedule_day_of_week",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "snapshot_schedule_day_of_month",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "compress",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "job_count",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "snapshot_schedule_hour_of_day",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "train_config",
              type: "CMsgSteamLearnTrainConfig",
              optional: true,
              description: "",
              extra: [
                {
                  name: "fetch_workers",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "fetch_chunk_size",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_batch_size",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_epoch_count",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_loss_improvement_threshold",
                  type: "float",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_no_loss_improvement_epoch_limit",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_optimizer",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_learning_rate",
                  type: "float",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_gpu",
                  type: "int32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "snapshot_filter",
              type: "CMsgSteamLearnProjectSnapshotFilter",
              optional: true,
              description: "",
              extra: [
                {
                  name: "sample_reduce_percent",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "histogram",
                  type: "CMsgSteamLearnProjectSnapshotFilterHistogram",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "data_element_path",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "min_value",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "max_value",
                      type: "float",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "num_buckets",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "map_data_element_sql_column[0]",
              type: "CMsgSteamLearnProjectConfig_MapDataElementSqlColumnEntry[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "key",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "value",
                  type: "int32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "total_sql_columns",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "data_retention_config",
              type: "CMsgSteamLearnDataRetentionConfig",
              optional: true,
              description: "",
              extra: [
                {
                  name: "snapshot_keep_duration_days",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "fetch_keep_count",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "scheduled_train_config",
              type: "CMsgSteamLearnScheduledTrainConfig",
              optional: true,
              description: "",
              extra: [
                {
                  name: "scheduled_type",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "scheduled_minute",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "scheduled_hour",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "scheduled_day_of_week",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "scheduled_day_of_month",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "auto_activate_accuracy_threshold",
                  type: "float",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "fetch_infos[0]",
              type: "CMsgSteamLearnFetchInfo[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "fetch_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "train_infos[0]",
              type: "CMsgSteamLearnTrainInfo[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "fetch_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "train_id",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "scheduled_train",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "auto_snapshot_pending",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
          ],
        },
        {
          name: "fetch",
          type: "CMsgSteamLearn_Train_Request_Fetch",
          optional: true,
          description: "",
          extra: [
            {
              name: "fetch_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "request_cancel",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "train",
          type: "CMsgSteamLearn_Train_Request_Train",
          optional: true,
          description: "",
          extra: [
            {
              name: "train_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "request_cancel",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "scheduled_train",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  ISteamMicroTxn: {
    AddToCart: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    AdjustAgreement: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user with the agreement",
        },
        {
          name: "agreementid",
          type: "uint64",
          optional: false,
          description: "ID of agreement",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "nextprocessdate",
          type: "string",
          optional: false,
          description: "Date for next process",
        },
      ],
    },
    CancelAgreement: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user with the agreement",
        },
        {
          name: "agreementid",
          type: "uint64",
          optional: false,
          description: "ID of agreement",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    CreateCart: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    FinalizeTxn: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
      ],
    },
    GetCartContents: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetReport: {
      _type: "publisher_only",
      version: 5,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "type",
          type: "string",
          optional: true,
          description: "Report type (GAMESALES, STEAMSTORE, SETTLEMENT)",
        },
        {
          name: "time",
          type: "string",
          optional: false,
          description:
            "Beginning time to start report from (RFC 3339 UTC format)",
        },
        {
          name: "maxresults",
          type: "uint32",
          optional: true,
          description: "Max number of results to return (up to 1000)",
        },
      ],
    },
    GetUserAgreementInfo: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user making purchase",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    GetUserInfo: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "SteamID of user making purchase",
        },
        {
          name: "ipaddress",
          type: "string",
          optional: true,
          description:
            "ip address of user in string format (xxx.xxx.xxx.xxx). Only required if usersession=web",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "AppID of game this transaction is for",
        },
      ],
    },
    InitTxn: {
      _type: "publisher_only",
      version: 3,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user making purchase",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "itemcount",
          type: "uint32",
          optional: false,
          description: "Number of items in cart",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "ISO 639-1 language code of description",
        },
        {
          name: "currency",
          type: "string",
          optional: false,
          description: "ISO 4217 currency code",
        },
        {
          name: "usersession",
          type: "string",
          optional: true,
          description:
            "session where user will authorize the transaction. client or web (defaults to client)",
        },
        {
          name: "ipaddress",
          type: "string",
          optional: true,
          description:
            "ip address of user in string format (xxx.xxx.xxx.xxx). Only required if usersession=web",
        },
        {
          name: "itemid[0]",
          type: "uint32[]",
          optional: false,
          description: "3rd party ID for item",
        },
        {
          name: "qty[0]",
          type: "uint32[]",
          optional: false,
          description: "Quantity of this item",
        },
        {
          name: "amount[0]",
          type: "int32[]",
          optional: false,
          description: "Total cost (in cents) of item(s)",
        },
        {
          name: "description[0]",
          type: "string[]",
          optional: false,
          description: "Description of item",
        },
        {
          name: "category[0]",
          type: "string[]",
          optional: true,
          description: "Optional category grouping for item",
        },
        {
          name: "associated_bundle[0]",
          type: "uint32[]",
          optional: true,
          description: "Optional bundleid of associated bundle",
        },
        {
          name: "billingtype[0]",
          type: "string[]",
          optional: true,
          description: "Optional recurring billing type",
        },
        {
          name: "startdate[0]",
          type: "string[]",
          optional: true,
          description: "Optional start date for recurring billing",
        },
        {
          name: "enddate[0]",
          type: "string[]",
          optional: true,
          description: "Optional end date for recurring billing",
        },
        {
          name: "period[0]",
          type: "string[]",
          optional: true,
          description: "Optional period for recurring billing",
        },
        {
          name: "frequency[0]",
          type: "uint32[]",
          optional: true,
          description: "Optional frequency for recurring billing",
        },
        {
          name: "recurringamt[0]",
          type: "string[]",
          optional: true,
          description: "Optional recurring billing amount",
        },
        {
          name: "bundlecount",
          type: "uint32",
          optional: true,
          description: "Number of bundles in cart",
        },
        {
          name: "bundleid[0]",
          type: "uint32[]",
          optional: true,
          description:
            "3rd party ID of the bundle. This shares the same ID space as 3rd party items.",
        },
        {
          name: "bundle_qty[0]",
          type: "uint32[]",
          optional: true,
          description: "Quantity of this bundle",
        },
        {
          name: "bundle_desc[0]",
          type: "string[]",
          optional: true,
          description: "Description of bundle",
        },
        {
          name: "bundle_category[0]",
          type: "string[]",
          optional: true,
          description: "Optional category grouping for bundle",
        },
      ],
    },
    IsValidCart: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    ProcessAgreement: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user with the agreement",
        },
        {
          name: "agreementid",
          type: "uint64",
          optional: false,
          description: "ID of agreement",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "amount",
          type: "int32",
          optional: false,
          description: "Total cost (in cents) to charge",
        },
        {
          name: "currency",
          type: "string",
          optional: false,
          description: "ISO 4217 currency code",
        },
      ],
    },
    QueryTxn: {
      _type: "publisher_only",
      version: 3,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "orderid",
          type: "uint64",
          optional: true,
          description: "3rd party ID for transaction",
        },
        {
          name: "transid",
          type: "uint64",
          optional: true,
          description: "Steam transaction ID",
        },
      ],
    },
    RefundTxn: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
      ],
    },
  },
  ISteamMicroTxnSandbox: {
    AdjustAgreement: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user with the agreement",
        },
        {
          name: "agreementid",
          type: "uint64",
          optional: false,
          description: "ID of agreement",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "nextprocessdate",
          type: "string",
          optional: false,
          description: "Date for next process",
        },
      ],
    },
    CancelAgreement: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user with the agreement",
        },
        {
          name: "agreementid",
          type: "uint64",
          optional: false,
          description: "ID of agreement",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    FinalizeTxn: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
      ],
    },
    GetReport: {
      _type: "publisher_only",
      version: 5,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "type",
          type: "string",
          optional: true,
          description: "Report type (GAMESALES, STEAMSTORE, SETTLEMENT)",
        },
        {
          name: "time",
          type: "string",
          optional: false,
          description:
            "Beginning time to start report from (RFC 3339 UTC format)",
        },
        {
          name: "maxresults",
          type: "uint32",
          optional: true,
          description: "Max number of results to return (up to 1000)",
        },
      ],
    },
    GetUserAgreementInfo: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user making purchase",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
      ],
    },
    GetUserInfo: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "SteamID of user making purchase",
        },
        {
          name: "ipaddress",
          type: "string",
          optional: true,
          description:
            "ip address of user in string format (xxx.xxx.xxx.xxx). Only required if usersession=web",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "AppID of game this transaction is for",
        },
      ],
    },
    InitTxn: {
      _type: "publisher_only",
      version: 3,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user making purchase",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "itemcount",
          type: "uint32",
          optional: false,
          description: "Number of items in cart",
        },
        {
          name: "language",
          type: "string",
          optional: false,
          description: "ISO 639-1 language code of description",
        },
        {
          name: "currency",
          type: "string",
          optional: false,
          description: "ISO 4217 currency code",
        },
        {
          name: "itemid[0]",
          type: "uint32[]",
          optional: false,
          description: "3rd party ID for item",
        },
        {
          name: "qty[0]",
          type: "uint32[]",
          optional: false,
          description: "Quantity of this item",
        },
        {
          name: "amount[0]",
          type: "int32[]",
          optional: false,
          description: "Total cost (in cents) of item(s)",
        },
        {
          name: "description[0]",
          type: "string[]",
          optional: false,
          description: "Description of item",
        },
        {
          name: "category[0]",
          type: "string[]",
          optional: true,
          description: "Optional category grouping for item",
        },
        {
          name: "billingtype[0]",
          type: "string[]",
          optional: true,
          description: "Optional recurring billing type",
        },
        {
          name: "startdate[0]",
          type: "string[]",
          optional: true,
          description: "Optional start date for recurring billing",
        },
        {
          name: "enddate[0]",
          type: "string[]",
          optional: true,
          description: "Optional end date for recurring billing",
        },
        {
          name: "period[0]",
          type: "string[]",
          optional: true,
          description: "Optional period for recurring billing",
        },
        {
          name: "frequency[0]",
          type: "uint32[]",
          optional: true,
          description: "Optional frequency for recurring billing",
        },
        {
          name: "recurringamt[0]",
          type: "string[]",
          optional: true,
          description: "Optional recurring billing amount",
        },
      ],
    },
    ProcessAgreement: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user with the agreement",
        },
        {
          name: "agreementid",
          type: "uint64",
          optional: false,
          description: "ID of agreement",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game",
        },
        {
          name: "amount",
          type: "int32",
          optional: false,
          description: "Total cost (in cents) to charge",
        },
        {
          name: "currency",
          type: "string",
          optional: false,
          description: "ISO 4217 currency code",
        },
      ],
    },
    QueryTxn: {
      _type: "publisher_only",
      version: 3,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "orderid",
          type: "uint64",
          optional: true,
          description: "3rd party ID for transaction",
        },
        {
          name: "transid",
          type: "uint64",
          optional: true,
          description: "Steam transaction ID",
        },
      ],
    },
    RefundTxn: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "POST",
      parameters: [
        {
          name: "orderid",
          type: "uint64",
          optional: false,
          description: "3rd party ID for transaction",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
      ],
    },
  },
  ISteamNews: {
    GetNewsForApp: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID to retrieve news for",
        },
        {
          name: "maxlength",
          type: "uint32",
          optional: true,
          description:
            "Maximum length for the content to return, if this is 0 the full content is returned, if it's less then a blurb is generated to fit.",
        },
        {
          name: "enddate",
          type: "uint32",
          optional: true,
          description:
            "Retrieve posts earlier than this date (unix epoch timestamp)",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "# of posts to retrieve (default 20)",
        },
        {
          name: "feeds",
          type: "string",
          optional: true,
          description: "Comma-separated list of feed names to return news for",
        },
        {
          name: "tags",
          type: "string",
          optional: true,
          description:
            "Comma-separated list of tags to filter by (e.g. 'patchnodes')",
        },
      ],
    },
    GetNewsForAppAuthed: {
      _type: "publisher_only",
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID to retrieve news for",
        },
        {
          name: "maxlength",
          type: "uint32",
          optional: true,
          description:
            "Maximum length for the content to return, if this is 0 the full content is returned, if it's less then a blurb is generated to fit.",
        },
        {
          name: "enddate",
          type: "uint32",
          optional: true,
          description:
            "Retrieve posts earlier than this date (unix epoch timestamp)",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "# of posts to retrieve (default 20)",
        },
        {
          name: "feeds",
          type: "string",
          optional: true,
          description: "Comma-seperated list of feed names to return news for",
        },
        {
          name: "tags",
          type: "string",
          optional: true,
          description:
            "Comma-separated list of tags to filter by (e.g. 'patchnodes')",
        },
      ],
    },
  },
  ISteamNodwin: {
    NodwinPaymentNotification: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [],
    },
  },
  ISteamNotificationService: {
    GetPreferences: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetSteamNotifications: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "include_hidden",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "language",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "include_confirmation_count",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_pinned_counts",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_read",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "count_only",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    HideNotification: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "notification_ids[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
      ],
    },
    MarkNotificationsRead: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "timestamp",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "notification_type",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "notification_ids[0]",
          type: "uint64[]",
          optional: true,
          description: "",
        },
        {
          name: "mark_all_read",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    MarkNotificationsViewed: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    SetPreferences: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "preferences[0]",
          type: "SteamNotificationPreference[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "notification_type",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "notification_targets",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  ISteamPayPalPaymentsHub: {
    PayPalPaymentsHubPaymentNotification: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [],
    },
  },
  ISteamPublishedItemSearch: {
    RankedByPublicationOrder: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "startidx",
          type: "uint32",
          optional: false,
          description: "Starting index in the result set (0 based)",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "Number Requested",
        },
        {
          name: "tagcount",
          type: "uint32",
          optional: false,
          description: "Number of Tags Specified",
        },
        {
          name: "usertagcount",
          type: "uint32",
          optional: false,
          description: "Number of User specific tags requested",
        },
        {
          name: "hasappadminaccess",
          type: "bool",
          optional: true,
          description:
            "Whether the user making the request is an admin for the app and can see private files",
        },
        {
          name: "fileType",
          type: "uint32",
          optional: true,
          description:
            "EPublishedFileInfoMatchingFileType, defaults to k_PFI_MatchingFileType_Items",
        },
        {
          name: "tag[0]",
          type: "string[]",
          optional: true,
          description: "Tag to filter result set",
        },
        {
          name: "usertag[0]",
          type: "string[]",
          optional: true,
          description: "A user specific tag",
        },
      ],
    },
    RankedByTrend: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "startidx",
          type: "uint32",
          optional: false,
          description: "Starting index in the result set (0 based)",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "Number Requested",
        },
        {
          name: "tagcount",
          type: "uint32",
          optional: false,
          description: "Number of Tags Specified",
        },
        {
          name: "usertagcount",
          type: "uint32",
          optional: false,
          description: "Number of User specific tags requested",
        },
        {
          name: "hasappadminaccess",
          type: "bool",
          optional: true,
          description:
            "Whether the user making the request is an admin for the app and can see private files",
        },
        {
          name: "fileType",
          type: "uint32",
          optional: true,
          description:
            "EPublishedFileInfoMatchingFileType, defaults to k_PFI_MatchingFileType_Items",
        },
        {
          name: "days",
          type: "uint32",
          optional: true,
          description:
            "[1,7] number of days for the trend period, including today",
        },
        {
          name: "tag[0]",
          type: "string[]",
          optional: true,
          description: "Tag to filter result set",
        },
        {
          name: "usertag[0]",
          type: "string[]",
          optional: true,
          description: "A user specific tag",
        },
      ],
    },
    RankedByVote: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "startidx",
          type: "uint32",
          optional: false,
          description: "Starting index in the result set (0 based)",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "Number Requested",
        },
        {
          name: "tagcount",
          type: "uint32",
          optional: false,
          description: "Number of Tags Specified",
        },
        {
          name: "usertagcount",
          type: "uint32",
          optional: false,
          description: "Number of User specific tags requested",
        },
        {
          name: "hasappadminaccess",
          type: "bool",
          optional: true,
          description:
            "Whether the user making the request is an admin for the app and can see private files",
        },
        {
          name: "fileType",
          type: "uint32",
          optional: true,
          description:
            "EPublishedFileInfoMatchingFileType, defaults to k_PFI_MatchingFileType_Items",
        },
        {
          name: "tag[0]",
          type: "string[]",
          optional: true,
          description: "Tag to filter result set",
        },
        {
          name: "usertag[0]",
          type: "string[]",
          optional: true,
          description: "A user specific tag",
        },
      ],
    },
    ResultSetSummary: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint64",
          optional: false,
          description: "appID relevant to all subsequent tags",
        },
        {
          name: "tagcount",
          type: "uint32",
          optional: false,
          description: "Number of Tags Specified",
        },
        {
          name: "usertagcount",
          type: "uint32",
          optional: false,
          description: "Number of User specific tags requested",
        },
        {
          name: "hasappadminaccess",
          type: "bool",
          optional: true,
          description:
            "Whether the user making the request is an admin for the app and can see private files",
        },
        {
          name: "fileType",
          type: "uint32",
          optional: true,
          description:
            "EPublishedFileInfoMatchingFileType, defaults to k_PFI_MatchingFileType_Items",
        },
        {
          name: "tag[0]",
          type: "string[]",
          optional: true,
          description: "Tag to filter result set",
        },
        {
          name: "usertag[0]",
          type: "string[]",
          optional: true,
          description: "A user specific tag",
        },
      ],
    },
  },
  ISteamPublishedItemVoting: {
    ItemVoteSummary: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Steam ID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "Count of how many items we are querying",
        },
        {
          name: "publishedfileid[0]",
          type: "uint64[]",
          optional: true,
          description: "The Published File ID who's vote details are required",
        },
      ],
    },
    UserVoteSummary: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "Steam ID of user",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "Count of how many items we are querying",
        },
        {
          name: "publishedfileid[0]",
          type: "uint64[]",
          optional: true,
          description: "A Specific Published Item",
        },
      ],
    },
  },
  ISteamRemoteStorage: {
    EnumerateUserSubscribedFiles: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "listtype",
          type: "uint32",
          optional: true,
          description: "EUCMListType",
        },
      ],
    },
    GetCollectionDetails: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "collectioncount",
          type: "uint32",
          optional: false,
          description: "Number of collections being requested",
        },
        {
          name: "publishedfileids[0]",
          type: "uint64[]",
          optional: false,
          description: "collection ids to get the details for",
        },
      ],
    },
    GetPublishedFileDetails: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "itemcount",
          type: "uint32",
          optional: false,
          description: "Number of items being requested",
        },
        {
          name: "publishedfileids[0]",
          type: "uint64[]",
          optional: false,
          description: "published file id to look up",
        },
      ],
    },
    GetUGCFileDetails: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description:
            "If specified, only returns details if the file is owned by the SteamID specified",
        },
        {
          name: "ugcid",
          type: "uint64",
          optional: false,
          description: "ID of UGC file to get info for",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
      ],
    },
    SetUGCUsedByGC: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "ugcid",
          type: "uint64",
          optional: false,
          description: "ID of UGC file whose bits are being fiddled with",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product to change updating state for",
        },
        {
          name: "used",
          type: "bool",
          optional: false,
          description: "New state of flag",
        },
      ],
    },
    SubscribePublishedFile: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
          description: "published file id to subscribe to",
        },
      ],
    },
    UnsubscribePublishedFile: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appID of product",
        },
        {
          name: "publishedfileid",
          type: "uint64",
          optional: false,
          description: "published file id to unsubscribe from",
        },
      ],
    },
  },
  ISteamSpecialSurvey: {
    CheckUserStatus: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "surveyid",
          type: "uint32",
          optional: false,
          description: "ID of the survey being taken",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of the user taking the survey",
        },
        {
          name: "token",
          type: "string",
          optional: false,
          description: "Survey identity verification token for the user",
        },
      ],
    },
    SetUserFinished: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "surveyid",
          type: "uint32",
          optional: false,
          description: "ID of the survey being taken",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of the user taking the survey",
        },
        {
          name: "token",
          type: "string",
          optional: false,
          description: "Survey identity verification token for the user",
        },
      ],
    },
  },
  ISteamTVService: {
    AddChatBan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Set the ban for a specific broadcaster. The issuer is the logged in steam account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "chatter_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "duration",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "permanent",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "undo",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    AddChatModerator: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Add or remove a moderator for this broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "moderator_steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "undo",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    AddWordBan: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Add or remove a banned keyword in this broadcast channel chat",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "word",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "undo",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    AppCheer: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "The user is cheering for a specific broadcast for a specific app.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "app_id",
          type: "uint32",
          optional: true,
          description: "App ID this cheer is for.",
        },
        {
          name: "cheer_target_id",
          type: "fixed64",
          optional: true,
          description:
            "The thing being cheered on. ID is app dependent (could be steam id, match id, lobby id, server id, etc).",
        },
        {
          name: "cheers[0]",
          type: "CSteamTV_AppCheer_SingleCheerType[]",
          optional: true,
          description:
            "The set of cheers this request represents (could be multiple of different types).",
          extra: [
            {
              name: "cheer_type",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "cheer_amount",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    CreateBroadcastChannel: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Create a channel on SteamTV",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "unique_name",
          type: "string",
          optional: true,
          description:
            "Unique short broadcast channel name, part of Steam.TV URL",
        },
      ],
    },
    FollowBroadcastChannel: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Follow a broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
        {
          name: "undo",
          type: "bool",
          optional: true,
          description: "Indicates this is an unfollow request",
        },
      ],
    },
    GetBroadcastChannelBroadcasters: {
      _type: "undocumented",
      version: 1,
      description: "Get list of broadcaster info for this channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
      ],
    },
    GetBroadcastChannelClips: {
      _type: "undocumented",
      version: 1,
      description: "Get broadcast channel clips",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetBroadcastChannelID: {
      _type: "undocumented",
      version: 1,
      description:
        "Get a broadcast channel ID for a channel by name or owner SteamID",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "unique_name",
          type: "string",
          optional: true,
          description: "Channel short name)",
        },
      ],
    },
    GetBroadcastChannelImages: {
      _type: "undocumented",
      version: 1,
      description: "Get broadcast channel images",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
        {
          name: "image_types",
          type: "EBroadcastImageType",
          optional: true,
          description: "list of EBroadcastImage",
        },
        {
          name: "image_types[0]",
          type: "int32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetBroadcastChannelInteraction: {
      _type: "undocumented",
      version: 1,
      description: "Get user's interaction status with a broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
      ],
    },
    GetBroadcastChannelLinks: {
      _type: "undocumented",
      version: 1,
      description: "Get broadcast channel link regions",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
      ],
    },
    GetBroadcastChannelProfile: {
      _type: "undocumented",
      version: 1,
      description: "Get broadcast channel profile data",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
      ],
    },
    GetBroadcastChannelStatus: {
      _type: "undocumented",
      version: 1,
      description: "Get broadcast channel live status",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
      ],
    },
    GetChannels: {
      _type: "undocumented",
      version: 1,
      description: "Get the list of featured broadcast channels",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "algorithm",
          type: "EGetChannelsAlgorithm",
          optional: true,
          description: "The algorithm to use when picking channels to return",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "The maximum number of results to return",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "Filter results to only this appid",
        },
      ],
    },
    GetChatBans: {
      _type: "undocumented",
      version: 1,
      description: "Get list of bans for a specific broadcaster.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetChatModerators: {
      _type: "undocumented",
      version: 1,
      description: "Returns the list of moderators for this broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    GetFollowedChannels: {
      _type: "undocumented",
      version: 1,
      description: "Get list of followed channels by a viewer",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetGames: {
      _type: "undocumented",
      version: 1,
      description: "Get list of games with active broadcasters",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "The ID for the game",
        },
        {
          name: "algorithm",
          type: "EGetGamesAlgorithm",
          optional: true,
          description: "The algorithm to use when picking games to return",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "The maximum number of results to return",
        },
      ],
    },
    GetHomePageContents: {
      _type: "undocumented",
      version: 1,
      description: "Returns homepage contents for user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetMyBroadcastChannels: {
      _type: "undocumented",
      version: 1,
      description: "Gets the broadcast channels that the current user owns",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetSteamTVUserSettings: {
      _type: "undocumented",
      version: 1,
      description: "Returns a user's SteamTV settings",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetSubscribedChannels: {
      _type: "undocumented",
      version: 1,
      description: "Get list of channels a user is subscribed to",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetWordBans: {
      _type: "undocumented",
      version: 1,
      description:
        "Returns the list of banned keywords for this broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    JoinChat: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Joins the chat channel for a broadcast",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
    ReportBroadcastChannel: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Report a broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
        {
          name: "reason",
          type: "string",
          optional: true,
          description: "The reason for the report",
        },
      ],
    },
    Search: {
      _type: "undocumented",
      version: 1,
      description: "Searches for broadcast channels based on input keywords",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "term",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SetBroadcastChannelImage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Set broadcast channel image hash",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
        {
          name: "image_type",
          type: "EBroadcastImageType",
          optional: true,
          description: "EBroadcastImage",
        },
        {
          name: "image_index",
          type: "uint32",
          optional: true,
          description:
            "Index of the image (for supporting multiple uploads of the same type",
        },
        {
          name: "image_width",
          type: "uint32",
          optional: true,
          description: "width in pixels",
        },
        {
          name: "image_height",
          type: "uint32",
          optional: true,
          description: "height in pixels",
        },
        {
          name: "file_size",
          type: "uint32",
          optional: true,
          description: "in bytes",
        },
        {
          name: "file_extension",
          type: "string",
          optional: true,
          description: "eg .jpg",
        },
        {
          name: "file_hash",
          type: "string",
          optional: true,
          description: "image SHA",
        },
        {
          name: "undo",
          type: "bool",
          optional: true,
          description: "indicates this is a delete request",
        },
      ],
    },
    SetBroadcastChannelLinkRegions: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Set broadcast channel link regions",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
        {
          name: "links[0]",
          type: "CSteamTV_SetBroadcastChannelLinkRegions_Request.Links[]",
          optional: true,
          description: "",
        },
      ],
    },
    SetBroadcastChannelProfile: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Set broadcast channel profile data",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
        {
          name: "name",
          type: "string",
          optional: true,
          description: "long channel name",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "primary channel language (Steam shortname)",
        },
        {
          name: "headline",
          type: "string",
          optional: true,
          description: "short channel desciption",
        },
        {
          name: "summary",
          type: "string",
          optional: true,
          description: "long channel desciption",
        },
        {
          name: "avatar_hash",
          type: "string",
          optional: true,
          description: "community avatar hash",
        },
        {
          name: "schedule",
          type: "string",
          optional: true,
          description: "broadcast channel schedule",
        },
        {
          name: "rules",
          type: "string",
          optional: true,
          description: "broadcast channel rules",
        },
        {
          name: "panels",
          type: "string",
          optional: true,
          description: "JSON data representing the channel panel layout",
        },
      ],
    },
    SetSteamTVUserSettings: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Sets a user's SteamTV settings",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "stream_live_email",
          type: "bool",
          optional: true,
          description: "Send email when followed stream starts",
        },
        {
          name: "stream_live_notification",
          type: "bool",
          optional: true,
          description: "Send Steam notification when followed stream starts",
        },
      ],
    },
    SubscribeBroadcastChannel: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Subscribe to a broadcast channel",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "broadcast_channel_id",
          type: "fixed64",
          optional: true,
          description: "Broadcast channel ID",
        },
      ],
    },
  },
  ISteamUser: {
    CheckAppOwnership: {
      _type: "publisher_only",
      version: 3,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID to check for ownership",
        },
      ],
    },
    GetAppPriceInfo: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appids",
          type: "string",
          optional: false,
          description: "Comma-delimited list of appids (max: 100)",
        },
      ],
    },
    GetDeletedSteamIDs: {
      _type: "undocumented",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Steamworks Web API publisher authentication key.",
        },
        {
          name: "rowversion",
          type: "uint64",
          optional: false,
          description:
            "An unsigned 64-bit value used to page through deleted accounts. Pass 0 when calling this\r\n            API for the first time, then pass the value returned from the previous call for each\r\n            additional request. This value will need to be stored on your server for future calls.",
        },
      ],
    },
    GetFriendList: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "relationship",
          type: "string",
          optional: true,
          description: "relationship type (ex: friend)",
        },
      ],
    },
    GetPlayerBans: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamids",
          type: "string",
          optional: false,
          description: "Comma-delimited list of SteamIDs",
        },
      ],
    },
    GetPlayerSummaries: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamids",
          type: "string",
          optional: false,
          description: "Comma-delimited list of SteamIDs (max: 100)",
        },
      ],
    },
    GetPublisherAppOwnership: {
      _type: "publisher_only",
      version: 4,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
      ],
    },
    GetPublisherAppOwnershipChanges: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "packagerowversion",
          type: "string",
          optional: false,
          description:
            "The unsigned 64-bit row version to read package changes from. The row version of data read up to will be returned for use in future calls.",
        },
        {
          name: "cdkeyrowversion",
          type: "string",
          optional: false,
          description:
            "The unsigned 64-bit row version to read CD Key changes from. The row version of data read up to will be returned for use in future calls.",
        },
      ],
    },
    GetUserGroupList: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
      ],
    },
    GrantPackage: {
      _type: "publisher_only",
      version: 3,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "packageid",
          type: "uint32",
          optional: false,
          description: "PackageID to grant",
        },
        {
          name: "ipaddress",
          type: "string",
          optional: true,
          description: "ip address of user in string format (xxx.xxx.xxx.xxx).",
        },
        {
          name: "thirdpartykey",
          type: "string",
          optional: true,
          description:
            "Optionally associate third party key during grant. 'thirdpartyappid' will have to be set.",
        },
        {
          name: "thirdpartyappid",
          type: "uint32",
          optional: true,
          description:
            "Has to be set if 'thirdpartykey' is set. The appid associated with the 'thirdpartykey'.",
        },
      ],
    },
    ResolveVanityURL: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "vanityurl",
          type: "string",
          optional: false,
          description: "The vanity URL to get a SteamID for",
        },
        {
          name: "url_type",
          type: "int32",
          optional: true,
          description:
            "The type of vanity URL. 1 (default): Individual profile, 2: Group, 3: Official game group",
        },
      ],
    },
    RevokePackage: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "packageid",
          type: "uint32",
          optional: false,
          description: "PackageID to grant",
        },
        {
          name: "revokereason",
          type: "string",
          optional: false,
          description: "Reason for why to revoke",
        },
      ],
    },
  },
  ISteamUserAuth: {
    AuthenticateUserTicket: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "ticket",
          type: "string",
          optional: false,
          description: "Ticket from GetAuthSessionTicket.",
        },
      ],
    },
  },
  ISteamUserOAuth: {
    GetFriendList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetGroupList: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetTokenDetails: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "access_token",
          type: "string",
          optional: false,
          description: "OAuth2 token for which to return details",
        },
      ],
    },
    GetUserSummaries: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    Search: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
  },
  ISteamUserStats: {
    GetGlobalAchievementPercentagesForApp: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "gameid",
          type: "uint64",
          optional: false,
          description: "GameID to retrieve the achievement percentages for",
        },
      ],
    },
    GetGlobalStatsForGame: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID that we're getting global stats for",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description: "Number of stats get data for",
        },
        {
          name: "name[0]",
          type: "string[]",
          optional: false,
          description: "Names of stat to get data for",
        },
        {
          name: "startdate",
          type: "uint32",
          optional: true,
          description: "Start date for daily totals (unix epoch timestamp)",
        },
        {
          name: "enddate",
          type: "uint32",
          optional: true,
          description: "End date for daily totals (unix epoch timestamp)",
        },
      ],
    },
    GetNumberOfCurrentPlayers: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID that we're getting user count for",
        },
      ],
    },
    GetPlayerAchievements: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID to get achievements for",
        },
        {
          name: "l",
          type: "string",
          optional: true,
          description: "Language to return strings for",
        },
      ],
    },
    GetSchemaForGame: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "l",
          type: "string",
          optional: true,
          description: "localized language to return (english, french, etc.)",
        },
      ],
    },
    GetUserStatsForGame: {
      version: 2,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
      ],
    },
    SetUserStatsForGame: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "SteamID of user",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "appid of game",
        },
        {
          name: "count",
          type: "uint32",
          optional: false,
          description:
            "Number of stats and achievements to set a value for (name/value param pairs)",
        },
        {
          name: "name[0]",
          type: "string[]",
          optional: false,
          description: "Name of stat or achievement to set",
        },
        {
          name: "value[0]",
          type: "uint32[]",
          optional: false,
          description: "Value to set",
        },
      ],
    },
  },
  ISteamWebAPIUtil: {
    GetServerInfo: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
    GetSupportedAPIList: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: true,
          description: "access key",
        },
      ],
    },
  },
  ISteamWorkshop: {
    AssociateWorkshopItems: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
        {
          name: "itemcount",
          type: "uint32",
          optional: false,
          description: "Number of items to associate",
        },
        {
          name: "publishedfileid[0]",
          type: "uint64[]",
          optional: true,
          description: "the workshop published file id",
        },
        {
          name: "gameitemid[0]",
          type: "uint32[]",
          optional: true,
          description: "3rd party ID for item",
        },
        {
          name: "revenuepercentage[0]",
          type: "float[]",
          optional: true,
          description:
            "Percentage of revenue the owners of the workshop item will get from the sale of the item [0.0, 100.0].  For bundle-like items, send over an entry for each item in the bundle (gameitemid = bundle id) with different publishedfileids and with the revenue percentage pre-split amongst the items in the bundle (i.e. 30% / 10 items in the bundle)",
        },
        {
          name: "gameitemdescription[0]",
          type: "string[]",
          optional: true,
          description: "Game's description of the game item",
        },
      ],
    },
    GetContributors: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID of game this transaction is for",
        },
      ],
    },
  },
  IStoreAppSimilarityService: {
    IdentifyClustersFromPlaytime: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "sort",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "clusters_to_return",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "cluster_index",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    PrioritizeAppsForUser: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "ids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "options",
          type: "StoreAppSimilarityPriorityOptions",
          optional: true,
          description: "",
          extra: [
            {
              name: "tag_score_factor",
              type: "double",
              optional: true,
              description: "",
            },
            {
              name: "playtime_max_seconds",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "playtime_max_games",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "playtime_score_factor",
              type: "double",
              optional: true,
              description: "",
            },
            {
              name: "popularity_factor",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "popularity_reciprocal",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "popularity_base_score",
              type: "int64",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "debug",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_owned_games",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IStoreBrowseService: {
    GetDLCForApps: {
      _type: "undocumented",
      version: 1,
      description: "Returns all DLC appids for games owned by the user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "store_page_filter",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter.SalePageFilter",
              optional: true,
              description: "",
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter.ContentHubFilter",
              optional: true,
              description: "",
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter.StoreFilter[]",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "steamid",
          type: "uint64",
          optional: true,
          description: "Returns all DLC appids for games owned by the user.",
        },
        {
          name: "appids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "Returns all DLC appids for games owned by the user.",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetDLCForAppsSolr: {
      _type: "undocumented",
      version: 1,
      description: "Returns all DLC appids for the specified games.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "flavor",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "store_page_filter",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter.SalePageFilter",
              optional: true,
              description: "",
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter.ContentHubFilter",
              optional: true,
              description: "",
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter.StoreFilter[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetHardwareItems: {
      _type: "undocumented",
      version: 1,
      description:
        "Get additional meta data specific to hardware store items (things that require physical shipping)",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "packageid[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetItems: {
      _type: "undocumented",
      version: 1,
      description: "Get information about items on the store",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "ids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetPriceStops: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "currency_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetStoreCategories: {
      _type: "undocumented",
      version: 1,
      description:
        "Get category definitions for store.  This is a public-facing API (as compared to StoreCatalog.GetCategories, which is intended for PHP)",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "elanguage",
          type: "int32",
          optional: true,
          description: "ELanguage",
        },
      ],
    },
  },
  IStoreCatalogService: {
    GetDevPageAllAppsLinked: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "clan_account_ids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "ignore_dlc",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IStoreMarketingService: {
    GetItemsToFeature: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "include_spotlights",
          type: "CStoreMarketing_GetItemsToFeature_Request_SpotlightFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "location",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "category",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "genre_id",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "include_dailydeals",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "include_top_specials_count",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "include_purchase_recommendations",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "additional_purchase_item_ids[0]",
          type: "StoreItemID[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "packageid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "bundleid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "tagid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "creatorid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hubcategoryid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IStoreQueryService: {
    GetItemsByUserRecommendedTags: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sort",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "filters",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter_SalePageFilter",
              optional: true,
              description: "",
              extra: [
                {
                  name: "sale_tagid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter_ContentHubFilter",
              optional: true,
              description: "",
              extra: [
                {
                  name: "hub_type",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "hub_category",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "hub_tagid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "discount_filter",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "optin",
                  type: "CStorePageFilter_ContentHubFilter_OptInInfo",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "name",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "optin_tagid",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "prune_tagid",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "optin_only",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter_StoreFilter[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "filter_json",
                  type: "string",
                  optional: true,
                  description: "",
                },
                {
                  name: "cache_key",
                  type: "string",
                  optional: true,
                  description: "",
                },
              ],
            },
          ],
        },
        {
          name: "recommended_tag_count",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "min_items_per_tags[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "sections[0]",
          type: "CStoreQuery_GetItemsByUserRecommendedTags_Request_Section[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "sort",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "min_items",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "randomize",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_packages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_bundles",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    Query: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "query_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "query",
          type: "CStoreQueryParams",
          optional: true,
          description: "",
          extra: [
            {
              name: "start",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "sort",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "filters",
              type: "CStoreQueryFilters",
              optional: true,
              description: "",
              extra: [
                {
                  name: "released_only",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "coming_soon_only",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "type_filters",
                  type: "CStoreQueryFilters_TypeFilters",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "include_apps",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_packages",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_bundles",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_games",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_demos",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_mods",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_dlc",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_software",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_video",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_hardware",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_series",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "include_music",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "tagids_must_match[0]",
                  type: "CStoreQueryFilters_TagFilter[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "tagids[0]",
                      type: "int32[]",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "tagids_exclude[0]",
                  type: "int32[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "price_filters",
                  type: "CStoreQueryFilters_PriceFilters",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "only_free_items",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "exclude_free_items",
                      type: "bool",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "content_descriptors_must_match[0]",
                  type: "int32[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "content_descriptors_excluded[0]",
                  type: "int32[]",
                  optional: true,
                  description: "",
                },
                {
                  name: "regional_top_n_sellers",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "global_top_n_sellers",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "regional_long_term_top_n_sellers",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "global_long_term_top_n_sellers",
                  type: "int32",
                  optional: true,
                  description: "",
                },
                {
                  name: "store_page_filter",
                  type: "CStorePageFilter",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "sale_filter",
                      type: "CStorePageFilter_SalePageFilter",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "sale_tagid",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                    {
                      name: "content_hub_filter",
                      type: "CStorePageFilter_ContentHubFilter",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "hub_type",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "hub_category",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "hub_tagid",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "discount_filter",
                          type: "int32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "optin",
                          type: "CStorePageFilter_ContentHubFilter_OptInInfo",
                          optional: true,
                          description: "",
                          extra: [
                            {
                              name: "name",
                              type: "string",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "optin_tagid",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "prune_tagid",
                              type: "uint32",
                              optional: true,
                              description: "",
                            },
                            {
                              name: "optin_only",
                              type: "bool",
                              optional: true,
                              description: "",
                            },
                          ],
                        },
                      ],
                    },
                    {
                      name: "store_filters[0]",
                      type: "CStorePageFilter_StoreFilter[]",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "filter_json",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "cache_key",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "parent_appids[0]",
                  type: "uint32[]",
                  optional: true,
                  description: "",
                },
              ],
            },
          ],
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "override_country_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    SearchSuggestions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "query_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "search_term",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "max_results",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "filters",
          type: "CStoreQueryFilters",
          optional: true,
          description: "",
          extra: [
            {
              name: "released_only",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "coming_soon_only",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "type_filters",
              type: "CStoreQueryFilters_TypeFilters",
              optional: true,
              description: "",
              extra: [
                {
                  name: "include_apps",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_packages",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_bundles",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_games",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_demos",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_mods",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_dlc",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_software",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_video",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_hardware",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_series",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "include_music",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "tagids_must_match[0]",
              type: "CStoreQueryFilters_TagFilter[]",
              optional: true,
              description: "",
              extra: [
                {
                  name: "tagids[0]",
                  type: "int32[]",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "tagids_exclude[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "price_filters",
              type: "CStoreQueryFilters_PriceFilters",
              optional: true,
              description: "",
              extra: [
                {
                  name: "only_free_items",
                  type: "bool",
                  optional: true,
                  description: "",
                },
                {
                  name: "exclude_free_items",
                  type: "bool",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "content_descriptors_must_match[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "content_descriptors_excluded[0]",
              type: "int32[]",
              optional: true,
              description: "",
            },
            {
              name: "regional_top_n_sellers",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "global_top_n_sellers",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "regional_long_term_top_n_sellers",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "global_long_term_top_n_sellers",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "store_page_filter",
              type: "CStorePageFilter",
              optional: true,
              description: "",
              extra: [
                {
                  name: "sale_filter",
                  type: "CStorePageFilter_SalePageFilter",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "sale_tagid",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                  ],
                },
                {
                  name: "content_hub_filter",
                  type: "CStorePageFilter_ContentHubFilter",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "hub_type",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "hub_category",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "hub_tagid",
                      type: "uint32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "discount_filter",
                      type: "int32",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "optin",
                      type: "CStorePageFilter_ContentHubFilter_OptInInfo",
                      optional: true,
                      description: "",
                      extra: [
                        {
                          name: "name",
                          type: "string",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "optin_tagid",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "prune_tagid",
                          type: "uint32",
                          optional: true,
                          description: "",
                        },
                        {
                          name: "optin_only",
                          type: "bool",
                          optional: true,
                          description: "",
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "store_filters[0]",
                  type: "CStorePageFilter_StoreFilter[]",
                  optional: true,
                  description: "",
                  extra: [
                    {
                      name: "filter_json",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                    {
                      name: "cache_key",
                      type: "string",
                      optional: true,
                      description: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "parent_appids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "use_spellcheck",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "search_tags",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "search_creators",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "prefilter_creators",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IStoreSalesService: {
    GetUserVotes: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sale_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetVoteDefinitions: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "sale_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    SetVote: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "voteid",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "sale_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IStoreService: {
    DeleteReservationPositionMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Marks a position is deleted and will no longer be surfaced",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "edistributor",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "product_identifier",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "start_queue_position",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetAllReservationPositionMessages: {
      _type: "undocumented",
      version: 1,
      description: "Marks a position is deleted and will no longer be surfaced",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetAppInfo: {
      _type: "undocumented",
      version: 1,
      parameters: [],
    },
    GetAppList: {
      version: 1,
      httpmethod: "GET",
      description: "Gets a list of apps available on the Steam Store.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "if_modified_since",
          type: "uint32",
          optional: true,
          description:
            "Return only items that have been modified since this date.",
        },
        {
          name: "have_description_language",
          type: "string",
          optional: true,
          description:
            "Return only items that have a description in this language.",
        },
        {
          name: "include_games",
          type: "bool",
          optional: true,
          description: "Include games (defaults to enabled)",
        },
        {
          name: "include_dlc",
          type: "bool",
          optional: true,
          description: "Include DLC",
        },
        {
          name: "include_software",
          type: "bool",
          optional: true,
          description: "Include software items",
        },
        {
          name: "include_videos",
          type: "bool",
          optional: true,
          description: "Include videos and series",
        },
        {
          name: "include_hardware",
          type: "bool",
          optional: true,
          description: "Include hardware",
        },
        {
          name: "last_appid",
          type: "uint32",
          optional: true,
          description:
            "For continuations, this is the last appid returned from the previous call.",
        },
        {
          name: "max_results",
          type: "uint32",
          optional: true,
          description:
            "Number of results to return at a time.  Default 10k, max 50k.",
        },
      ],
    },
    GetDiscoveryQueue: {
      _type: "undocumented",
      version: 1,
      description: "Get a list of games for the user to explore on the store.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "queue_type",
          type: "EStoreDiscoveryQueueType",
          optional: true,
          description: "",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "rebuild_queue",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "settings_changed",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "settings",
          type: "CStoreDiscoveryQueueSettings",
          optional: true,
          description: "",
          extra: [
            {
              name: "os_win",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "os_mac",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "os_linux",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "full_controller_support",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "native_steam_controller",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_coming_soon",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "excluded_tagids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
            {
              name: "exclude_early_access",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "exclude_videos",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "exclude_software",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "exclude_dlc",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "exclude_soundtracks",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "featured_tagids[0]",
              type: "uint32[]",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "rebuild_queue_if_stale",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "ignore_user_preferences",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "no_experimental_results",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "experimental_cohort",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "debug_get_solr_query",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "store_page_filter",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter.SalePageFilter",
              optional: true,
              description: "",
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter.ContentHubFilter",
              optional: true,
              description: "",
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter.StoreFilter[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetDiscoveryQueueSettings: {
      _type: "undocumented",
      version: 1,
      description:
        "Get the settings that were used to generate a user's discovery queue.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "queue_type",
          type: "EStoreDiscoveryQueueType",
          optional: true,
          description: "",
        },
        {
          name: "store_page_filter",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter.SalePageFilter",
              optional: true,
              description: "",
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter.ContentHubFilter",
              optional: true,
              description: "",
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter.StoreFilter[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetDiscoveryQueueSkippedApps: {
      _type: "undocumented",
      version: 1,
      description:
        "Returns all the apps skipped so far in the given discovery queue for the given user.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "queue_type",
          type: "EStoreDiscoveryQueueType",
          optional: true,
          description: "",
        },
        {
          name: "store_page_filter",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter.SalePageFilter",
              optional: true,
              description: "",
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter.ContentHubFilter",
              optional: true,
              description: "",
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter.StoreFilter[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetLocalizedNameForTags: {
      _type: "undocumented",
      version: 1,
      description: "Gets tag names in a different language",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "tagids[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
      ],
    },
    GetMostPopularTags: {
      _type: "undocumented",
      version: 1,
      description: "Get all whitelisted tags, with localized names.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetTagList: {
      _type: "undocumented",
      version: 1,
      description: "Get the list of tags, localized",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "have_version_hash",
          type: "string",
          optional: true,
          description:
            "The hash returned in the last call.  Will return no results if the list hasn't changed.",
        },
      ],
    },
    GetUserGameInterestState: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Get information about a user's relationship to a game - ownership, wishlist, discovery queue state, etc.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "store_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "beta_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetWishlistDemoEmailStatus: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "demo_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    MigratePartnerLinkTracking: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Move UTM data from the PartnerLinkTrackingLogNoUser table to the PartnerLinkTrackingLogWithUser table",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "accountid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "browserid",
          type: "uint64",
          optional: true,
          description: "",
        },
        {
          name: "backfill_source",
          type: "EPartnerLinkTrackingBackfillSource",
          optional: true,
          description: "",
        },
      ],
    },
    QueueWishlistDemoEmailToFire: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "demo_appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    ReloadAllReservationPositionMessages: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Refreshes all of the caches through the store features servers",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    SetReservationPositionMessage: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Creates/Update a reservation position message for people in the queue or next queue position for people deciding to join",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "settings[0]",
          type: "CReservationPositionMessage[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "edistributor",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "product_identifier",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "start_queue_position",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_estimated_notification",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "localization_token",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "accountid",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "rtime_created",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    SkipDiscoveryQueueItem: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Skip an item in the user's queue.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "queue_type",
          type: "EStoreDiscoveryQueueType",
          optional: true,
          description: "",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "store_page_filter",
          type: "CStorePageFilter",
          optional: true,
          description: "",
          extra: [
            {
              name: "sale_filter",
              type: "CStorePageFilter.SalePageFilter",
              optional: true,
              description: "",
            },
            {
              name: "content_hub_filter",
              type: "CStorePageFilter.ContentHubFilter",
              optional: true,
              description: "",
            },
            {
              name: "store_filters[0]",
              type: "CStorePageFilter.StoreFilter[]",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    UpdatePackageReservations: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Updates the reservations for a user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "packages_to_reserve[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "packages_to_unreserve[0]",
          type: "uint32[]",
          optional: true,
          description: "",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IStoreTopSellersService: {
    GetCountryList: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "language",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetWeeklyTopSellers: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "context",
          type: "StoreBrowseContext",
          optional: true,
          description: "",
          extra: [
            {
              name: "language",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "elanguage",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "country_code",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "steam_realm",
              type: "int32",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "data_request",
          type: "StoreBrowseItemDataRequest",
          optional: true,
          description: "",
          extra: [
            {
              name: "include_assets",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_release",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_platforms",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_all_purchase_options",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_screenshots",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_trailers",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_ratings",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_tag_count",
              type: "int32",
              optional: true,
              description: "",
            },
            {
              name: "include_reviews",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_basic_info",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_supported_languages",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_full_description",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_included_items",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "included_item_data_request",
              type: "StoreBrowseItemDataRequest",
              optional: true,
              description: "",
            },
            {
              name: "include_assets_without_overrides",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "apply_user_filters",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "include_links",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
        {
          name: "start_date",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "page_start",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "page_count",
          type: "int32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  ITFItems_440: {
    GetGoldenWrenches: {
      version: 2,
      httpmethod: "GET",
      parameters: [],
    },
  },
  ITFPromos_440: {
    GetItemID: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
        {
          name: "promoid",
          type: "uint32",
          optional: false,
          description: "The promo ID to grant an item for",
        },
      ],
    },
    GrantItem: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
        {
          name: "promoid",
          type: "uint32",
          optional: false,
          description: "The promo ID to grant an item for",
        },
      ],
    },
  },
  ITFPromos_620: {
    GetItemID: {
      version: 1,
      httpmethod: "GET",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
        {
          name: "PromoID",
          type: "uint32",
          optional: false,
          description: "The promo ID to grant an item for",
        },
      ],
    },
    GrantItem: {
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
          description: "The Steam ID to fetch items for",
        },
        {
          name: "PromoID",
          type: "uint32",
          optional: false,
          description: "The promo ID to grant an item for",
        },
      ],
    },
  },
  ITFSystem_440: {
    GetWorldStatus: {
      version: 1,
      httpmethod: "GET",
      parameters: [],
    },
  },
  ITestExternalPrivilegeService: {
    CallPublisherKey: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    CallPublisherKeyOwnsApp: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
  },
  ITest_TransportErrorService: {
    InvalidService: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
  },
  ITrustService: {
    GetTrustScore: {
      _type: "undocumented",
      version: 1,
      httpmethod: "GET",
      description:
        "Returns the Trust Score for the provided account in the specified appid.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
      ],
    },
  },
  ITwoFactorService: {
    AddAuthenticator: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Add two-factor authenticator to the logged-in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "steamid to use",
        },
        {
          name: "authenticator_time",
          type: "uint64",
          optional: true,
          description: "Current authenticator time",
        },
        {
          name: "serial_number",
          type: "fixed64",
          optional: true,
          description: "locally computed serial (deprecated)",
        },
        {
          name: "authenticator_type",
          type: "uint32",
          optional: true,
          description: "Authenticator type",
        },
        {
          name: "device_identifier",
          type: "string",
          optional: true,
          description: "Authenticator identifier",
        },
        {
          name: "sms_phone_id",
          type: "string",
          optional: true,
          description: "ID of phone to use for SMS verification",
        },
        {
          name: "http_headers[0]",
          type: "string[]",
          optional: true,
          description: "HTTP headers alternating by K/V",
        },
        {
          name: "version",
          type: "uint32",
          optional: true,
          description: "What the version of our token should be",
        },
      ],
    },
    CreateEmergencyCodes: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Generate emergency authenticator codes",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    DestroyEmergencyCodes: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Destroy emergency authenticator codes for the account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "steamid to use",
        },
      ],
    },
    FinalizeAddAuthenticator: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Finalize two-factor authentication addition to the logged-in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "steamid to use",
        },
        {
          name: "authenticator_code",
          type: "string",
          optional: true,
          description: "Current auth code",
        },
        {
          name: "authenticator_time",
          type: "uint64",
          optional: true,
          description: "Current authenticator time",
        },
        {
          name: "activation_code",
          type: "string",
          optional: true,
          description: "Activation code from out-of-band message",
        },
        {
          name: "http_headers[0]",
          type: "string[]",
          optional: true,
          description: "HTTP headers alternating by K/V",
        },
        {
          name: "validate_sms_code",
          type: "bool",
          optional: true,
          description:
            "When finalizing with an SMS code, pass the request on to the PhoneService to update its state too.",
        },
      ],
    },
    QueryStatus: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Get two-factor authentication settings for the logged-in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "steamid to use",
        },
      ],
    },
    QueryTime: {
      _type: "undocumented",
      version: 1,
      description: "Get server's idea of the current time",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sender_time",
          type: "uint64",
          optional: true,
          description:
            "Current time on the sender (for stats, don't trust this)",
        },
      ],
    },
    RemoveAuthenticator: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Remove two-factor authentication addition from the logged-in account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "revocation_code",
          type: "string",
          optional: true,
          description: "Password needed to remove token",
        },
        {
          name: "revocation_reason",
          type: "uint32",
          optional: true,
          description: "Reason the authenticator is being removed",
        },
        {
          name: "steamguard_scheme",
          type: "uint32",
          optional: true,
          description: "Type of Steam Guard to use once token is removed",
        },
        {
          name: "remove_all_steamguard_cookies",
          type: "bool",
          optional: true,
          description: "Remove all steamguard cookies",
        },
      ],
    },
    RemoveAuthenticatorViaChallengeContinue: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Continue challenge-based authenticator removal",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "sms_code",
          type: "string",
          optional: true,
          description: "Code from SMS",
        },
        {
          name: "generate_new_token",
          type: "bool",
          optional: true,
          description: "Generate new token (instead of removing old one)",
        },
        {
          name: "version",
          type: "uint32",
          optional: true,
          description: "What the version of our token should be",
        },
      ],
    },
    RemoveAuthenticatorViaChallengeStart: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Start challenge-based authenticator removal",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    SendEmail: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Send email to the account",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "Steamid to use",
        },
        {
          name: "email_type",
          type: "uint32",
          optional: true,
          description: "Type of email to send (ETwoFactorEmailType::*)",
        },
        {
          name: "include_activation_code",
          type: "bool",
          optional: true,
          description: "Include activation code in email parameters",
        },
      ],
    },
    UpdateTokenVersion: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Update the version for my token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
        {
          name: "version",
          type: "uint32",
          optional: true,
          description: "What the version of our token should be",
        },
        {
          name: "signature",
          type: "bytes",
          optional: true,
          description: "HMAC digest over user's private key",
        },
      ],
    },
    ValidateToken: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Validate (and consume) a token",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "code",
          type: "string",
          optional: true,
          description: "code to validate",
        },
      ],
    },
  },
  IUserAccountService: {
    GetAvailableValveDiscountPromotions: {
      _type: "undocumented",
      version: 1,
      description:
        "Gets the available promotional discounts available to the user",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "country_code",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetClientWalletDetails: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description: "Returns balance and details about any users wallet",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "include_balance_in_usd",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "wallet_region",
          type: "int32",
          optional: true,
          description: "",
        },
        {
          name: "include_formatted_balance",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    GetUserCountry: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Get the country code associated with the passed steamid (only available for logged-in user or support)",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "fixed64",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IUserGameNotesService: {
    DeleteNote: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "shortcut_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "shortcutid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "note_id",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
    GetGamesWithNotes: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
      ],
    },
    GetNotesForGame: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "shortcut_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "shortcutid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "include_content",
          type: "bool",
          optional: true,
          description: "",
        },
      ],
    },
    SaveNote: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "shortcut_name",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "shortcutid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "note_id",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "create_new",
          type: "bool",
          optional: true,
          description: "",
        },
        {
          name: "title",
          type: "string",
          optional: true,
          description: "",
        },
        {
          name: "content",
          type: "string",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IUserReviewsService: {
    GetFriendsRecommendedApp: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
    GetIndividualRecommendations: {
      _type: "undocumented",
      version: 1,
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "requests[0]",
          type: "CUserReviews_GetIndividualRecommendations_Request_RecommendationRequest[]",
          optional: true,
          description: "",
          extra: [
            {
              name: "steamid",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "appid",
              type: "uint32",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IVACManagementService: {
    GameModuleLoadReport: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "GameModuleLoadReport",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "file_report",
          type: "string",
          optional: false,
        },
        {
          name: "total_files",
          type: "uint32",
          optional: false,
        },
        {
          name: "process_id",
          type: "uint32",
          optional: false,
        },
        {
          name: "internal_error",
          type: "uint32",
          optional: false,
        },
        {
          name: "command_line",
          type: "string",
          optional: false,
        },
        {
          name: "insecure",
          type: "bool",
          optional: false,
        },
        {
          name: "launch_report",
          type: "string",
          optional: false,
        },
        {
          name: "diagnostics",
          type: "string",
          optional: false,
        },
        {
          name: "steamid_reporter",
          type: "uint64",
          optional: false,
        },
      ],
    },
  },
  IVideoService: {
    GetVideoBookmarks: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Returns the video bookmarks locations for the specific videos. Includes playback settings per video",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appids[0]",
          type: "uint32[]",
          optional: true,
          description:
            "List of App IDs to grab bookmarks for. Can be empty if using updated_since.",
        },
        {
          name: "updated_since",
          type: "uint32",
          optional: true,
          description:
            "Only return results after time. Min value is 1. (seconds since epoch January 1st, 1970 Unix Time)",
        },
      ],
    },
    SetVideoBookmark: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      description:
        "Bookmarks the locations in the video the user has reached. As as record playback settings per video. Fire and forget.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "bookmarks[0]",
          type: "VideoBookmark[]",
          optional: true,
          description: "list of bookmarks we want to store.",
          extra: [
            {
              name: "app_id",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "playback_position_in_seconds",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "video_track_id",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "audio_track_id",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "timedtext_track_id",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "last_modified",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "hide_from_watch_history",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "hide_from_library",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
  },
  IWishlistService: {
    AddToWishlist: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
        {
          name: "navdata",
          type: "CUserInterface_NavData",
          optional: true,
          description: "",
          extra: [
            {
              name: "domain",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "controller",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "method",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "submethod",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "feature",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "depth",
              type: "uint32",
              optional: true,
              description: "",
            },
            {
              name: "countrycode",
              type: "string",
              optional: true,
              description: "",
            },
            {
              name: "webkey",
              type: "uint64",
              optional: true,
              description: "",
            },
            {
              name: "is_client",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "curator_data",
              type: "CUserInterface_CuratorData",
              optional: true,
              description: "",
              extra: [
                {
                  name: "clanid",
                  type: "uint32",
                  optional: true,
                  description: "",
                },
                {
                  name: "listid",
                  type: "uint64",
                  optional: true,
                  description: "",
                },
              ],
            },
            {
              name: "is_likely_bot",
              type: "bool",
              optional: true,
              description: "",
            },
            {
              name: "is_utm",
              type: "bool",
              optional: true,
              description: "",
            },
          ],
        },
      ],
    },
    GetWishlist: {
      version: 1,
      httpmethod: "GET",
      description: "Get a user's wishlist.",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
      ],
    },
    GetWishlistItemCount: {
      version: 1,
      httpmethod: "GET",
      description: "Get the number of items on a user's wishlist.",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
      ],
    },
    GetWishlistSortedFiltered: {
      version: 1,
      httpmethod: "GET",
      description:
        "Get a user's paginated wishlist applying various sorts and filters",
      parameters: [
        {
          name: "steamid",
          type: "uint64",
          optional: false,
        },
        {
          name: "context",
          type: "{message}",
          optional: false,
        },
        {
          name: "data_request",
          type: "{message}",
          optional: false,
          description: "If passed, item data will be returned",
        },
        {
          name: "sort_order",
          type: "{enum}",
          optional: true,
        },
        {
          name: "filters",
          type: "{message}",
          optional: false,
        },
        {
          name: "start_index",
          type: "int32",
          optional: true,
          description:
            "Data in this range will be filled in with StoreBrowse data",
        },
        {
          name: "page_size",
          type: "int32",
          optional: true,
        },
      ],
    },
    RemoveFromWishlist: {
      _type: "undocumented",
      version: 1,
      httpmethod: "POST",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: true,
          description: "",
        },
      ],
    },
  },
  IWorkshopService: {
    AddSpecialPayment: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Add a special payment for an appid/gameitemid.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
          description: "AppID",
        },
        {
          name: "gameitemid",
          type: "uint32",
          optional: false,
          description: "Game Item ID",
        },
        {
          name: "date",
          type: "string",
          optional: false,
          description: "YYY-MM-DD formatted string",
        },
        {
          name: "payment_us_usd",
          type: "uint64",
          optional: false,
          description: "US Payment portion in USD Cents",
        },
        {
          name: "payment_row_usd",
          type: "uint64",
          optional: false,
          description: "ROW Payment portion in USD Cents",
        },
      ],
    },
    GetFinalizedContributors: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description:
        "Get a list of contributors for a specific gameitemid/app combination.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "gameitemid",
          type: "uint32",
          optional: false,
        },
      ],
    },
    GetItemDailyRevenue: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "GET",
      description:
        "Get item revenue for a specific app/item definition for a date range.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "item_id",
          type: "uint32",
          optional: false,
        },
        {
          name: "date_start",
          type: "uint32",
          optional: false,
        },
        {
          name: "date_end",
          type: "uint32",
          optional: false,
        },
      ],
    },
    PopulateItemDescriptions: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Populate block of item descriptions.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "languages",
          type: "{message}",
          optional: false,
        },
      ],
    },
    SetItemPaymentRules: {
      _type: "publisher_only",
      version: 1,
      httpmethod: "POST",
      description: "Set item payment rules.",
      parameters: [
        {
          name: "key",
          type: "string",
          optional: false,
          description: "Access key",
        },
        {
          name: "appid",
          type: "uint32",
          optional: false,
        },
        {
          name: "gameitemid",
          type: "uint32",
          optional: false,
        },
        {
          name: "associated_workshop_files",
          type: "{message}",
          optional: false,
        },
        {
          name: "partner_accounts",
          type: "{message}",
          optional: false,
        },
        {
          name: "validate_only",
          type: "bool",
          optional: true,
          description: "Only validates the rules and does not persist them.",
        },
        {
          name: "make_workshop_files_subscribable",
          type: "bool",
          optional: false,
        },
        {
          name: "associated_workshop_file_for_direct_payments",
          type: "{message}",
          optional: false,
        },
      ],
    },
  },
};

run();
