export const Legitimuz = ({
  host,
  token,
  lang = "pt",
  appURL = null,
  onSuccess = null,
  onError = null,
  eventHandler = null,
  enableRedirect = false,
  autoOpenValidation = false,
  enableSMSConfirmation = false,
  onlySMSConfirmation = false,
}) => {

  try {
    if (!host) throw new Error("Host is required!");
    if (!token) throw new Error("Token is required!");

    //#region Data
    /** @type {HTMLDivElement|null} modal */
    let modal = null;
    /** @type {HTMLIFrameElement|null} iframe */
    let iframe = null;

    const state = {
      sessionId: null,
      deviceInfo: null,
      referenceId: null,
      appURL: appURL ?? 'https://widget.legitimuz.com',
      lang,
      encodedData: null
    }

    const fields = [
      { apiNode: "cpf", name: "cpf", id: "legitimuz-hydrate-cpf" },
      { apiNode: "nome", name: "name", id: "legitimuz-hydrate-name" },
      {
        apiNode: "nome_mae",
        name: "motherName",
        id: "legitimuz-hydrate-motherName",
      },
      { apiNode: "email", name: "email", id: "legitimuz-hydrate-email" },
      { apiNode: "celular", name: "phone", id: "legitimuz-hydrate-phone" },
      {
        apiNode: "data_nascimento",
        name: "birthdate",
        id: "legitimuz-hydrate-birthdate",
      },
      { apiNode: "idade", name: "age", id: "legitimuz-hydrate-age" },
      { apiNode: "genero", name: "gender", id: "legitimuz-hydrate-gender" },
      {
        apiNode: "nacionalidade",
        name: "nationality",
        id: "legitimuz-hydrate-nationality",
      },
      { apiNode: "signo", name: "sign", id: "legitimuz-hydrate-sign" },
      // Location
      { apiNode: "cep", name: "zipCode", id: "legitimuz-hydrate-zipCode" },
      { apiNode: "endereco", name: "address", id: "legitimuz-hydrate-address" },
      {
        apiNode: "endereco_nro",
        name: "addressNumber",
        id: "legitimuz-hydrate-addressNumber",
      },
      {
        apiNode: "bairro",
        name: "neighborhood",
        id: "legitimuz-hydrate-neighborhood",
      },
      {
        apiNode: "complemento",
        name: "complement",
        id: "legitimuz-hydrate-complement",
      },
      { apiNode: "cidade", name: "city", id: "legitimuz-hydrate-city" },
      { apiNode: "estado", name: "state", id: "legitimuz-hydrate-state" },
      // Others
      { apiNode: "ref_id", name: "referenceId", id: "legitimuz-ref-id" },
    ];

    /**
     * @type {Array.<{name: String, id: String, callback: async (event: Event) => void}>} actions
     */
    const actions = [
      {
        name: "verify",
        id: "legitimuz-action-verify",
        async callback(event) {
          event.preventDefault();
          console.info("[Legitimuz]", `Call action: ${this.name}`);

          try {
            const cpfEl = getElementByFieldName("cpf");
            const normalizedCPF = onlyNumber(cpfEl.value);

            if (!normalizedCPF) throw new Error("CPF field not found");

            if (normalizedCPF.length !== 11) {
              cpfEl.setAttribute("data-legitimuz-invalid", false);
              cpfEl.focus();
              throw new Error("Invalid CPF");
            }

            if (!modal || !iframe) throw new Error("Modal element not found");

            const refIdEl = getElementByFieldName("referenceId");
            if (refIdEl) state.referenceId = refIdEl.value;

            await verifyDocument({ cpf: normalizedCPF, referenceId: state.referenceId });

          } catch (error) {
            console.warn("[Legitimuz]", error);
          }
        },
      },
      {
        name: "close-verify",
        id: "legitimuz-action-close_dialog",
        async callback(event) {
          event.preventDefault();
          console.info("[Legitimuz]", `Call action: ${this.name}`);
          closeModal();
        },
      }
    ];
    //#endregion


    /**
    * @param {{cpf: string, referenceId: string|null}} input
    */
    const verifyDocument = async ({ cpf, referenceId = null }) => {
      if (!cpf) throw new Error("CPF not found");

      if (cpf.length !== 11) {
        throw new Error("Invalid CPF, must be 11 digits");
      }

      if (!modal || !iframe) throw new Error("Modal element not found");

      state.sessionId = await generateSession({ token, cpf: cpf });

      if (!state.sessionId) throw new Error("SessionId not found");
      openModal({
        sessionId: state.sessionId,
        lang: state.lang,
        referenceId: referenceId
      });
    }

    //#region Helpers
    const onlyNumber = (value) => {
      return String(value)
        .trim()
        .replace(/[^\d]+/g, "");
    };

    const openModal = ({ sessionId, lang, referenceId }) => {
      const feature = window.innerWidth <= 844 ? "ocr" : "qr-code";
      const embedFeaturePath = new URL(`${state.appURL}/${feature}/${state.encodedData}`);
      embedFeaturePath.searchParams.set("lang", lang);
      if (referenceId) embedFeaturePath.searchParams.set("refId", referenceId);

      iframe.src = embedFeaturePath;
      iframe.setAttribute("data-legitimuz-feature", feature);

      document.body.style.overflow = "hidden";
      document.body.style.padding = "0";
      iframe.setAttribute("data-open", true);
      modal.style.display = "flex";
    };

    const closeModal = () => {
      if (!modal) {
        console.warn("[Legitimuz]", "Modal element not found");
        return;
      }

      iframe.setAttribute("data-open", false);
      document.body.style.overflow = "";
      document.body.style.padding = "";
      modal.style.display = "none";
      iframe.src = "";
    };

    const generateDeviceInfo = () => {
      const browserName = navigator.appName;
      const osName = navigator.platform;
      const agent = navigator.userAgent;
      return `${browserName}, ${osName}, ${agent}`
    }
    //#endregion

    //#region Core
    const generateSession = async ({ token, cpf }) => {
      try {
        const formData = new FormData();
        formData.append("cpf", cpf);
        formData.append("token", token);

        const response = await fetch(`${host}/external/kyc/session`, {
          method: "post",
          body: formData
        });

        const {
          session_id = null,
          message = null,
          errors = [],
        } = await response.json();

        if (!response.ok || message === "error" || !session_id) {
          alert(errors.length !== 0 ? errors[0] : "Erro desconhecido!");
          return null;
        }

        const dataToSend = {
          token: token,
          origin: window.location.host,
          session_id: session_id,
          enableSMSConfirmation,
          onlySMSConfirmation
        }

        state.encodedData = encodeToBase64UrlSafe(dataToSend);

        return session_id;
      } catch (error) {
        console.warn("[Legitimuz]", error);
        return null;
      }
    };

    function encodeToBase64UrlSafe(jsonData) {
      const stringifiedData = JSON.stringify(jsonData);
      const base64 = btoa(unescape(encodeURIComponent(stringifiedData))); // Encode to Base64
      const base64UrlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // Make URL-safe
      return base64UrlSafe;
    }

    const getElementByFieldName = (fieldName) => {
      const cachedField = fields.find((field) => field.name === fieldName);
      if (!cachedField) return null;
      return document.querySelector(`#${cachedField.id}`);
    };

    const changeFieldId = ({ fieldName, fieldId }) => {
      if (!fieldName) throw new Error("FieldName is required!");
      if (!fieldId) throw new Error("FieldId is required!");

      const fieldIndex = fields.findIndex((field) => field.name === fieldName);

      if (fieldIndex < 0) {
        throw new Error(`Field name '${fieldName}' not found!`);
      }

      fields[fieldIndex].id = fieldId;
    };

    const changeActionId = ({ actionName, actionId }) => {
      if (!actionName) throw new Error("ActionName is required!");
      if (!actionId) throw new Error("ActionId is required!");

      const actionIndex = actions.findIndex(
        (action) => action.name === actionName
      );

      if (actionIndex < 0) {
        throw new Error(`Action name '${actionName}' not found!`);
      }

      actions[actionIndex].id = actionId;
    };

    const setLang = (lang) => {
      if (!["pt", "en", "es"].includes(lang)) throw new Error("Invalid lang");
      state.lang = lang;

      if (!iframe.src) return;

      const resourcePath = new URL(iframe.src);
      resourcePath.searchParams.set("lang", state.lang);
      iframe.src = resourcePath;
    };

    const setupStyles = () => {
      // Prevent compatibility issues with "dvh" on iOS
      const toolbarHeight = window.screen.availHeight - window.innerHeight;
      document.documentElement.style.setProperty(
        "--lz-popup-height",
        `${window.screen.availHeight - toolbarHeight}px`
      );

      const style = document.createElement("style");
      style.setAttribute("type", "text/css");
      style.innerHTML = `
        .lz-dialog { position:fixed; top:0; left:0; max-height: 100dvh; width: 100%; height:var(--lz-popup-height,100dvh); display:none; justify-content:center; align-items:center; z-index:999999; background:rgba(0,0,0,0.3); backdrop-filter:blur(4px);}
        .lz-dialog__content { position:relative; background:#fff; width: 100%; height:100%; max-height: 800px; max-width: 576px; border-radius:16px; overflow:hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);}
        .lz-dialog__close { position:absolute !important; top:8px !important; right:12px !important; color:#ccc !important; font-size:18px !important; font-weight:600 !important; outline:none !important; background:none !important; border:none !important;}
        @media screen and (max-width:844px) { .lz-dialog__content {max-width: 100%; max-height: var(--lz-popup-height,100dvh);} }
      `;
      document.getElementsByTagName("head")[0].appendChild(style);
    };

    const setupModal = () => {
      const rootContainer = document.getElementById("legitimuz-root");

      if (!rootContainer) {
        console.warn(`'#legitimuz-root' not found!`);
        return;
      }

      rootContainer.innerHTML = "";

      iframe = document.createElement("iframe");
      iframe.id = "legitimuz-iframe";
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.frameborder = "0";
      iframe.allow = "camera;microphone";

      modal = document.createElement("div");
      modal.id = "legitimuz-dialog";
      modal.className = "lz-dialog";
      modal.innerHTML = `
      <div class="lz-dialog__content">
        ${!autoOpenValidation
          ? `<button id="legitimuz-action-close_dialog" class="lz-dialog__close">&times;</button>`
          : ""
        }
      </div>
      `;

      modal.querySelector(".lz-dialog__content").appendChild(iframe);

      rootContainer.appendChild(modal);
    };

    const setupActions = () => {
      for (const action of actions) {
        const actionEl = document.querySelector(`#${action.id}`);
        if (!actionEl) continue;
        actionEl.setAttribute("data-legitimuz-loading", false);
        actionEl.onclick = (event) => action.callback(event);
      }
    };

    const setupListeners = () => {
      const updateIframeSrc = () => {
        const feature = iframe.getAttribute("data-legitimuz-feature");
        const isOpen = iframe.getAttribute("data-open") === "true";

        if (!isOpen) return;

        if (!feature) {
          console.warn("[Legitimuz]", "Feature not found");
          return;
        }

        if (!state.sessionId) {
          console.warn("[Legitimuz]", "SessionId not found");
          return;
        }

        const isDesktop = window.innerWidth >= 845;
        const isMobile = window.innerWidth < 845;

        if (isDesktop && feature !== "qr-code") {
          iframe.setAttribute("data-legitimuz-feature", "qr-code");
          const featureURL = new URL(`${state.appURL}/qr-code/${state.encodedData}`);
          featureURL.searchParams.set("lang", state.lang);
          if (state.referenceId) featureURL.searchParams.set("refId", state.referenceId);
          iframe.src = featureURL;
        } else if (isMobile && feature !== "ocr") {
          iframe.setAttribute("data-legitimuz-feature", "ocr");
          const featureURL = new URL(`${state.appURL}/ocr/${state.encodedData}`);
          featureURL.searchParams.set("lang", state.lang);
          if (state.referenceId) featureURL.searchParams.set("refId", state.referenceId);
          iframe.src = featureURL;
        }
      };

      window.addEventListener("resize", () => {
        document.documentElement.style.setProperty(
          "--lz-popup-height",
          `${window.screen.availHeight}px`
        );
        updateIframeSrc();
      });

      window.onmessage = (event) => {
        const eventData = event.data;
        if (event.origin !== state.appURL) return;

        const enableEvents = ['ocr', 'facematch', 'redirect', 'sms-confirmation'];
        if (!eventData?.type && enableEvents.includes(eventData?.name)) {
          const { name, status } = eventData;

          // Redirect if option is enabled
          if (name === "redirect" && enableRedirect) {
            if (!eventData?.url) {
              console.warn("[Legitimuz SDK]", "Redirect URL not found");
              return;
            }
            window.location.href = eventData.url;
            return;
          }

          if (!!eventHandler) eventHandler(eventData);

          // @deprecated
          if (status === "success" && !!onSuccess) onSuccess(name)
          if (status === "error" && !!onError) onError(name)
          return;
        }

        // REMOVE THIS @deprecated
        if (eventData?.type === "success" && !!onSuccess) {
          onSuccess(eventData.name)
        }

        if (eventData?.name === "close-modal") {
          closeModal()
        }

        if (eventData?.type === "error" && onError) {
          onError(eventData.name);
        }
      };
    };
    //#endregion

    const mount = async () => {
      // Generate a device fingerprint
      state.deviceInfo = generateDeviceInfo();

      setupStyles();
      setupModal();
      setupActions();
      setupListeners();
    };

    const checkCPF = (cpf) => {
      const cpfOnlyNumber = cpf.replace(/[^\d]+/g, '');
      if (cpfOnlyNumber == '') return false;
      // Elimina CPFs invalidos conhecidos
      if (cpfOnlyNumber.length != 11 ||
        cpfOnlyNumber == "00000000000" ||
        cpfOnlyNumber == "11111111111" ||
        cpfOnlyNumber == "22222222222" ||
        cpfOnlyNumber == "33333333333" ||
        cpfOnlyNumber == "44444444444" ||
        cpfOnlyNumber == "55555555555" ||
        cpfOnlyNumber == "66666666666" ||
        cpfOnlyNumber == "77777777777" ||
        cpfOnlyNumber == "88888888888" ||
        cpfOnlyNumber == "99999999999")
        return false;
      // Valida 1o digito
      add = 0;
      for (i = 0; i < 9; i++)
        add += parseInt(cpfOnlyNumber.charAt(i)) * (10 - i);
      rev = 11 - (add % 11);
      if (rev == 10 || rev == 11)
        rev = 0;
      if (rev != parseInt(cpfOnlyNumber.charAt(9)))
        return false;
      // Valida 2o digito
      add = 0;
      for (i = 0; i < 10; i++)
        add += parseInt(cpfOnlyNumber.charAt(i)) * (11 - i);
      rev = 11 - (add % 11);
      if (rev == 10 || rev == 11)
        rev = 0;
      if (rev != parseInt(cpfOnlyNumber.charAt(10)))
        return false;
      return true;
    }

    return {
      mount,
      setLang,
      closeModal,
      changeFieldId,
      changeActionId,
      verifyDocument,
      checkCPF
    };
  } catch (error) {
    console.warn("[Legitimuz]", error);
  }
};
