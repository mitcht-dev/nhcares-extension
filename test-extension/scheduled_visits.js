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
        this.activeCustomElements = null;

        // DOM Table Element locators
        this.DYNAMIC_SELECTORS = {
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
          VISIT_LINK: '.visit_link',
          CLIENT_LINK: 'a[href*="/clients/"]',
        };

        this.CUSTOM_ELEMENTS = {
          NEW: {
            HEADER: (title, identifier) => {
              const th = document.createElement('th');
              th.setAttribute('role', 'cell');
              // Custom identifer
              th.classList.add(`custom-${identifier}`);
              th.style = 'min-width: 5rem;';

              const div = document.createElement('div');
              div.classList.add('p-column-header-content')
              th.appendChild(div);

              const span = document.createElement('span');
              span.classList.add('p-column-title')
              span.textContent = title;
              div.appendChild(span);

              return th;
            },
            CELL: (text, identifier) => {
              const td = document.createElement('td');
              // Custom identifer
              td.classList.add(`custom-${identifier}`);
              td.setAttribute('role', 'cell');
              td.style = 'min-width: 10rem;';
              td.textContent = text;

              return td;
            },
          },
          LEGACY: {
            HEADER: (title, identifier) => {
              const th = document.createElement('th');
              th.classList.add(`datatable-column___${identifier}`)
              // Custom identifer
              th.classList.add(`custom-${identifier}`);
              // Need to change from hardcoded value eventually
              th.setAttribute('data-v-0352e0fe', '');
              //th.style = 'width: 5em;';
              th.style = 'width: 5px;';

              const div = document.createElement('div');
              div.classList.add('column-contents')
              div.style = 'position: relative;';
              div.textContent = title;
              th.appendChild(div);

              return th;
            },
            CELL: (text, identifier) => {
              const td = document.createElement('td');
              td.classList.add(`datatable-column___${identifier}`)
              // Custom identifer
              td.classList.add(`custom-${identifier}`);
              // Need to change from hardcoded value eventually
              td.setAttribute('data-v-0352e0fe', '');
              //td.style = 'height: 40px; width: 5em; text-wrap: wrap;';
              td.style = 'height: 40px;';

              const span1 = document.createElement('span');
              td.appendChild(span1);

              const span2 = document.createElement('span');
              span2.classList.add('break-line')
              span2.textContent = text;
              span1.appendChild(span2);

              return td;
            },
          },
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
          
          this.fetchClientInfo(visitId, clientId);
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
        const tagsIdentifier = 'client-tags';
        const cityText = clientInfo.demographics?.city || clientInfo.client_city || '<span style="color:#ccc">--</span>';
        const cityIdentifier = 'client-city';

        this.upsertCell(rowElement, tagsText, tagsIdentifier);
        this.upsertCell(rowElement, cityText, cityIdentifier);
      }

      // Check if page is displaying New or Legacy table
      determineSelectors() {
        if (document.querySelector(this.DYNAMIC_SELECTORS.NEW.TABLE)) {
          this.activeSelectors = this.DYNAMIC_SELECTORS.NEW;
          this.activeCustomElements = this.CUSTOM_ELEMENTS.NEW;
          return true;
        } else if (document.querySelector(this.DYNAMIC_SELECTORS.LEGACY.TABLE)) {
          this.activeSelectors = this.DYNAMIC_SELECTORS.LEGACY;
          this.activeCustomElements = this.CUSTOM_ELEMENTS.LEGACY;
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

        const tagsIdentifier = 'client-tags';
        if (!theadRow.querySelector(`.custom-${tagsIdentifier}`)) {
          const tagsHeader = this.activeCustomElements.HEADER('Client Tags', tagsIdentifier);
          theadRow.insertBefore(tagsHeader, theadRow.firstChild);
        }
        
        const cityIdentifier = 'client-city';
        if (!theadRow.querySelector(`.custom-${cityIdentifier}`)) {
          const cityHeader = this.activeCustomElements.HEADER('Client City', cityIdentifier);
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

      upsertCell(row, content, identifier) {
        let cell = row.querySelector(`.custom-${identifier}`);
        if (!cell) {
            cell = this.activeCustomElements.CELL(content, identifier);
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
