// Scheduled Visits Module
// Adds Tags and Client City columns to the scheduled visits table

// Prevent multiple executions
if (!window.ScheduledVisitsLoaded) {
  window.ScheduledVisitsLoaded = true;

  (function () {
    'use strict';

    const originalFetch = window.fetch;

    class ScheduledVisitsViewManager {
      constructor() {
        // Data store
        this.visitMap = {};
        this.clientMap = {};

        // Mutation Observer
        this.tableObserver = null;

        // Filter State
        this.activeSelectors = null;

        // DOM Table Element locators
        this.SELECTORS = {
          NEW: {
            TABLE: 'table[role="table"].p-datatable-table',
            TH_ROW: 'thead[role="rowgroup"].p-datatable-thead',
            TH_CELL: 'th[role="cell"]',
            BODY: 'tbody[role="rowgroup"].p-datatable-tbody',
            ROW: 'tr[role="row"]',
            TITLE: '.p-column-title',
            CELL: 'td[role="cell"]',
          },
          LEGACY: {
            TABLE: 'table#datatable',
            TH_ROW: 'thead',
            TH_CELL: 'th',
            BODY: 'tbody',
            ROW: 'tr',
            TITLE: 'div.column-content-label',
            CELL: 'td',
          },
        };

        this.STATIC_SELECTORS = {
          TAGS_CLASS: 'custom-tags-column',
          CITY_CLASS: 'custom-city-column',
          VISIT_LINK: '.visit_link',
          CLIENT_LINK: 'a[href*="/clients/"]',
        };

        this.ENDPOINTS = {
          SCHEDULED_VISITS: '/api/v1/scheduler/scheduled_visits',
          GET_CLIENT_BY_ID: (clientId) => `/ext/api/v2/patients/clients/${clientId}`,
          GET_EMPLOYEE_BY_ID: (employeeId) => `/ext/api/v2/employees/employees/${employeeId}`
        };

        this.init();
      }

      init() {
        // Augment fetch and XML requests
        this.injectNetworking();
        // Determine selectors and watch for table changes
        this.observePage();
      }

      injectNetworking() {
        window.fetch = (...args) => {
          const url = args[0];

          if (typeof url === 'string' && url.includes(this.ENDPOINTS.SCHEDULED_VISITS)) {
            return originalFetch.apply(window, args).then(response => {
              const clonedResponse = response.clone();

              clonedResponse.json().then(data => {
                this.processVisitData(data);
              }).catch((err) => {
                console.error('[Vibe Extension - Visits] Error processing data:', err);
              });

              return response;
            });
          }

          return originalFetch.apply(window, args);
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
          this._url = url;
          return originalOpen.apply(this, arguments);
        };

        // Capture class instance
        const self = this;

        XMLHttpRequest.prototype.send = function () {
          if (this._url?.includes(self.ENDPOINTS.SCHEDULED_VISITS)) {
            this.addEventListener('load', function () {
              if (this.status === 200) {
                try {
                  let data;

                  // Handle different response types
                  if (this.responseType === 'blob' || this.responseType === '') {
                    if (this.response instanceof Blob) {
                      // Convert blob to text then parse
                      const reader = new FileReader();
                      reader.onload = function () {
                        try {
                          const data = JSON.parse(reader.result);
                          self.processVisitData(data);
                        } catch (err) {
                          console.error('[Vibe Extension - Visits] Error parsing blob:', err);
                        }
                      };
                      reader.readAsText(this.response);
                    } else if (this.responseText) {
                      data = JSON.parse(this.responseText);
                      self.processVisitData(data);
                    }
                  } else if (this.responseType === 'json') {
                    data = this.response;
                    self.processVisitData(data);
                  } else if (this.responseText) {
                    data = JSON.parse(this.responseText);
                    self.processVisitData(data);
                  }
                } catch (err) {
                  console.error('[Vibe Extension - Visits] Error processing XHR response:', err);
                }
              }
            });
          }

          return originalSend.apply(this, arguments);
        };
      }

      processVisitData(data) {
        if (!data?.items || !Array.isArray(data.items)) return;

        data.items.forEach(visit => {

          const visitId = visit.id || null;
          const clientId = visit.client.id || visit.client_id || null;
          
          this.visitMap[visitId] = this.clientMap[clientId];

          if (!this.clientMap[clientId]) {
            this.fetchClientInfo(visitId, clientId);
          } else {
            this.updateRow(visitId);
          }
        });
      }

      // Function to fetch client tags and city for a specific client
      async fetchClientInfo(visitId, clientId) {
        try {
          const response = await originalFetch(this.ENDPOINTS.GET_CLIENT_BY_ID(clientId));

          if (response.ok) {
            const clientData = await response.json();

            this.clientMap[clientId] = clientData;
            this.visitMap[visitId] = clientData;

            this.updateRow(visitId);
          }
        } catch (err) {
          console.error('[Vibe Extension - Visits] Error fetching client data:', err);
        }
      }

      updateRow(visitId) {
        const allRows = document.querySelectorAll(`${this.activeSelectors.BODY} > ${this.activeSelectors.ROW}`);

        const rowElement = Array.from(allRows).find(r => {
          const link = r.querySelector(this.STATIC_SELECTORS.VISIT_LINK);
          return link && link.textContent.trim() === String(visitId);
        });

        if (!rowElement) return;

        const clientInfo = this.visitMap[visitId];

        const clientTags = clientInfo.tags_v2 || clientInfo.tags || [];
        const tagsText = this.filterAndFormatTags(clientTags);
        const cityText = clientInfo.demographics?.city || clientInfo.client_city || '<span style="color:#ccc">--</span>';

        this.upsertCell(rowElement, this.STATIC_SELECTORS.TAGS_CLASS, tagsText);
        this.upsertCell(rowElement, this.STATIC_SELECTORS.CITY_CLASS, cityText);
      }

      // Check if page is displaying New or Legacy table
      determineSelectors() {
        if (document.querySelector(this.SELECTORS.NEW.TABLE)) {
          this.activeSelectors = this.SELECTORS.NEW;
          return true;
        } else if (document.querySelector(this.SELECTORS.LEGACY.TABLE)) {
          this.activeSelectors = this.SELECTORS.LEGACY;
          return true;
        }

        // No table located
        return false;
      }

      observePage() {
        setInterval(() => {
          if (!this.isScheduledVisitsPage()) {
            return;
          };

          const ready = this.determineSelectors();

          if (ready) {
            const table = document.querySelector(this.activeSelectors.TABLE);
            if (table) {
              this.injectHeaders();
              if (!this.tableObserver) this.initializeTableObserver(table);
            }
          }
        }, 2000);
      }

      injectHeaders() {
        const theadRow = document.querySelector(`${this.activeSelectors.TH_ROW} > ${this.activeSelectors.ROW}`);
        if (!theadRow) return;

        const createHeader = (text, cls) => {
          const th = document.createElement('th');
          th.setAttribute('role', 'custom-column-header');
          th.classList.add(cls);
          th.style.minWidth = '10rem';
          th.innerHTML = `<div class="p-column-header-content"><span class="p-column-title">${text}</span></div>`;
          return th;
        }

        if (!theadRow.querySelector(`.${this.STATIC_SELECTORS.TAGS_CLASS}`)) {
          const tagsHeader = createHeader('Client Tags', this.STATIC_SELECTORS.TAGS_CLASS);
          theadRow.insertBefore(tagsHeader, theadRow.firstChild);
        }
        
        if (!theadRow.querySelector(`.${this.STATIC_SELECTORS.CITY_CLASS}`)) {
          const cityHeader = createHeader('Client City', this.STATIC_SELECTORS.CITY_CLASS);
          theadRow.insertBefore(cityHeader, theadRow.firstChild);
        }
      }

      initializeTableObserver(table) {
        if (this.tableObserver) this.tableObserver.disconnect();

        const tbody = table.querySelector(this.activeSelectors.BODY);
        if (!tbody) return;

        this.tableObserver = new MutationObserver(mutations => {
          let shouldRender = false;
          mutations.forEach(m => {
            if (m.addedNodes.length) shouldRender = true;
          });
          if (shouldRender) {
            this.injectHeaders();
            this.updateAllRows();
          }
        });

        this.tableObserver.observe(tbody, { childList: true, subtree: false });
      }

      updateAllRows() {
        Object.keys(this.visitMap).forEach(visit => {
          this.updateRow(visit);
        });
      }

      upsertCell(row, className, content) {
        let cell = row.querySelector(`.${className}`);
        if (!cell) {
            cell = document.createElement('td');
            cell.className = className;
            cell.setAttribute('role', 'cell');
            cell.style.minWidth = '10rem';
            row.insertBefore(cell, row.firstChild);
        }
        // Use placeholder comment for Vue consistency
        const htmlContent = `${content}`;
        if (cell.innerHTML !== htmlContent) {
            cell.innerHTML = htmlContent;
        }
      }

      // Function to filter and format tags based on business logic
      filterAndFormatTags(tags) {
        if (!tags?.length) {
          return 'No CG Preference';
        }

        const tagNames = tags.map(tag => tag.name || tag);

        // Check for Female Caregiver and Male Caregiver
        const hasFemaleCaregiver = tagNames.some(name => name === 'Female Caregiver');
        const hasMaleCaregiver = tagNames.some(name => name === 'Male Caregiver');

        // If both exist or neither exist, show "No CG Preference"
        const caregiverPreference = hasFemaleCaregiver === hasMaleCaregiver
          ? 'No CG Preference'
          : (hasFemaleCaregiver ? 'Female CG Only' : 'Male CG Only');

        // Filter tags that start with "Vital"
        const vitalTags = tagNames.filter(name => name.startsWith('Vital'));

        // Combine caregiver preference with vital tags
        const filteredTags = [caregiverPreference, ...vitalTags];

        return filteredTags.join(', ');
      }
      // Function to check if URL is the scheduled visits page
      isScheduledVisitsPage() {
        return window.location.href.includes('scheduling/scheduled-visits');
      }
    }

    window.vibeScheduledVisits = new ScheduledVisitsViewManager();

  })(); // End of IIFE
} // End of if (!window.ScheduledVisitsLoaded)
