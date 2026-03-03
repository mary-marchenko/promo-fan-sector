(function () {

    const apiURL = 'https://allwin-prom.pp.ua/api_fan_sector'

    let isVerifiedUser = false;
    let periodAmount = 2 // кількість періодів в акції, треба для кешування інфи з табли
    let tableData = []
    let activeWeek = null
    let isPromoOver = false

    const mainPage = document.querySelector(".fan"),
        unauthMsgs = document.querySelectorAll('.unauth-msg'),
        participateBtns = document.querySelectorAll('.part-btn'),
        redirectBtns = document.querySelectorAll('.play-btn'),
        loader = document.querySelector(".spinner-overlay"),
        resultsTable = document.querySelector('#table'),
        resultsTableOther = document.querySelector('#tableOther'),
        tableTabs = document.querySelectorAll('.table__tabs-item')

    const ukLeng = document.querySelector('#ukLeng');
    const enLeng = document.querySelector('#enLeng');

    const toggleClasses = (elements, className) => elements.forEach(el => el.classList.toggle(`${className}`));
    const toggleTranslates = (elements, dataAttr) => elements.forEach(el => {
        el.setAttribute('data-translate', `${dataAttr}`)
        el.innerHTML = i18nData[dataAttr] || '*----NEED TO BE TRANSLATED----*   key:  ' + dataAttr;
        el.removeAttribute('data-translate');
    });

    let locale = "uk"

    let loaderBtn = false

    if (ukLeng) locale = 'uk';
    if (enLeng) locale = 'en';

    let debug = false

    if (debug) hideLoader()

    let i18nData = {};
    const translateState = true;

    let userId = null

    const request = function (link, extraOptions) {
        return fetch(apiURL + link, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            ...(extraOptions || {})
        })
            .then(res => {
                if (!res.ok) throw new Error('API error');
                return res.json();
            })
            .catch(err => {
                console.error('API request failed:', err);

                reportError(err);

                return Promise.reject(err);
            });

    }

    function hideLoader(){
        loader.classList.add("hide")
        document.body.style.overflow = "auto"
        mainPage.classList.remove("loading")
    }

    function checkUserAuth() {
        if (userId) {
            for (const unauthMes of unauthMsgs) {
                unauthMes.classList.add('hide');
            }
            return request(`/promouser/${userId}?nocache=1`)
                .then(res => {
                    if (res.userid) {
                        participateBtns.forEach(item => item.classList.add('hide'));
                        redirectBtns.forEach(item => item.classList.remove('hide'));
                        isVerifiedUser = true;
                    } else {
                        participateBtns.forEach(item => item.classList.remove('hide'));
                        redirectBtns.forEach(item => item.classList.add('hide'));
                        isVerifiedUser = false;
                    }

                })
        } else {
            for (let redirectBtn of redirectBtns) {
                redirectBtn.classList.add('hide');
            }
            for (let participateBtn of participateBtns) {
                participateBtn.classList.add('hide');
            }
            for (const unauthMes of unauthMsgs) {
                unauthMes.classList.remove('hide');
            }

            return Promise.resolve(false);
        }
    }

    function participate() {
        if (!userId) {
            return;
        }
        const params = { userid: userId };
        fetch(apiURL + '/user/', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(params)
        }).then(res => res.json())
            .then(res => {
                loaderBtn = true
                toggleClasses(participateBtns, "loader")
                toggleTranslates(participateBtns, "loader")
                setTimeout(() =>{
                    toggleTranslates(participateBtns, "loader_ready")
                    toggleClasses(participateBtns, "done")
                    toggleClasses(participateBtns, "loader")
                }, 500)
                setTimeout(()=>{
                    checkUserAuth()
                    loadUsers("?nocache=1").then(res => {
                        renderUsers(activeWeek, tableData)
                    })
                }, 1000)

            })
            .catch(err => {
                console.error('API request failed:', err);

                reportError(err);

                return Promise.reject(err);
            });
    }
    function loadUsers(parametr) {
        const requests = [];
        tableData.length = 0
        for (let i = 1; i <= periodAmount; i++) {
            const week = i; // або будь-яка логіка для формування номера тижня
            const req = request(`/users/${week}${parametr ? parametr : ""}`).then(data => {
                tableData.push({ week, data: data });
                if(!activeWeek){
                    activeWeek = data.activeStageNumber
                }
                isPromoOver = data.isPromoOver
            });

            requests.push(req);
        }
        // renderUsers(activeWeek, requests);

        return Promise.all(requests)
            .catch(error => {
                console.error('Error loading users:', error);
            });
    }

    function reportError(err) {
        const reportData = {
            origin: window.location.href,
            userid: userId,
            errorText: err?.error || err?.text || err?.message || 'Unknown error',
            type: err?.name || 'UnknownError',
            stack: err?.stack || ''
        };

        fetch('', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        }).catch(console.warn);
    }

    function translate() {
        const elems = document.querySelectorAll('[data-translate]')
        if (elems && elems.length) {

            if(translateState){
                elems.forEach(elem => {
                    const key = elem.getAttribute('data-translate');
                    elem.innerHTML = i18nData[key] || '*----NEED TO BE TRANSLATED----*   key:  ' + key;
                    if (i18nData[key]) {
                        elem.removeAttribute('data-translate');
                    }
                })
            }else{
                console.log("translation works!")
            }
        }
        if (locale === 'en') {
            mainPage.classList.add('en');
        }
        refreshLocalizedClass();

    }

    function refreshLocalizedClass(element, baseCssClass) {
        if (!element) {
            return;
        }
        for (const lang of ['uk', 'en']) {
            element.classList.remove(baseCssClass + lang);
        }
        element.classList.add(baseCssClass + locale);
    }

    function renderUsers(weekNum, userData = []) {
        weekNum = Number(weekNum);
        const weekObj = userData.find(w => w.week === weekNum);
        if (!weekObj || !weekObj.data || !Array.isArray(weekObj.data.users)) {
            console.error('Невірна структура даних');
            return;
        }

        const isStageEnded = weekObj.data.isStageEnded

        userData = weekObj.data.users;


        const currentUser = userData.find(user => user.userid === userId);

        if(userId && !currentUser && isVerifiedUser){
            userData = [...userData, {userid: userId, points: 0}]
        }
        populateUsersTable(userData, userId, weekNum, currentUser, isVerifiedUser, isStageEnded);
    }

    function populateUsersTable(users, currentUserId, week, currentUser, isVerifiedUser, isStageEnded) {
        if (!users?.length) return;
        resultsTable.innerHTML = '';
        resultsTableOther.innerHTML = '';

        const isTopCurrentUser = currentUser && users.slice(0, 10).some(user => user.userid === currentUserId);

        const topUsersLength = !currentUser || isTopCurrentUser ? 13 : 10;

        const topUsers = users.slice(0, topUsersLength);

        topUsers.forEach(user => {
            displayUser(user, user.userid === currentUserId, resultsTable, topUsers, isTopCurrentUser, week);
        });
        if(isVerifiedUser && !currentUser) {
            displayUser(currentUser, true, resultsTableOther, users, false, week);
        }
        if (!isTopCurrentUser && currentUser) {
            isVerifiedUser = false;
            displayUser(currentUser, true, resultsTableOther, users, false, week);
        }
    }

    function displayUser(user, isCurrentUser, table, users, isTopCurrentUser, week) {
        const renderRow = (userData, options = {}) => {
            const { highlight = false, neighbor = false } = options;
            const userRow = document.createElement('div');
            userRow.classList.add('table__row');

            const userPlace = users.indexOf(userData) + 1;
            const prizeKey = debug ? null : getPrizeTranslationKey(userData.points, userPlace);


            if (userPlace <= 3) {
                userRow.classList.add(`place${userPlace}`);
            }

            if (highlight || isCurrentUser && !neighbor) {
                userRow.classList.add('you');
            } else if (neighbor) {
                userRow.classList.add('_neighbor');
            }

            userRow.innerHTML = `
           <div class="table__row-item">
                ${userPlace}
<!--                ${userPlace < 10 ? '0' + userPlace : userPlace}-->
                ${isCurrentUser && !neighbor ? '<span class="you">' + translateKey("you") + '</span>' : ''}
            </div>
            <div class="table__row-item">
                ${isCurrentUser && !neighbor ? userData.userid : maskUserId(userData.userid)}
            </div>
            <div class="table__row-item">
               ${Number(userData.points).toFixed(2)}
            </div>
            <div class="table__row-item">
                ${prizeKey ? translateKey(prizeKey) : ' - '}
            </div>
        `;

            table.append(userRow);
        };
        if (isCurrentUser && !isTopCurrentUser) {
            const index = users.indexOf(user);
            if (index !== 10 && users[index - 1]) {
                renderRow(users[index - 1], { neighbor: true });
            }
            renderRow(user, { highlight: true });
            if (users[index + 1]) {
                renderRow(users[index + 1], { neighbor: true });
            }
        } else {
            renderRow(user);
        }
    }

    function translateKey(key, defaultValue) {
        if (!key) {
            return;
        }
        let needKey = debug ? key : `*----NEED TO BE TRANSLATED----* key: ${key}`

        defaultValue =  needKey || key;
        return i18nData[key] || defaultValue;
    }

    function maskUserId(userId) {
        return "**" + userId.toString().slice(2);
    }

    function getPrizeTranslationKey(points, place) {
        if (points == null || points < 5) return null;
        if (place >= 1 && place <= 5) return `prize_${place}`;
        if (place >= 6 && place <= 10) return `prize_6-10`;
        if (place >= 11 && place <= 15) return `prize_11-15`;
        if (place >= 16 && place <= 20) return `prize_16-20`;
        if (place >= 21 && place <= 50) return `prize_21-50`;
        if (place >= 51 && place <= 100) return `prize_51-100`;
    }

    async function init() {
        let attempts = 0;
        const maxAttempts = 20;
        const attemptInterval = 50;

        function tryDetectUserId() {
            if (window.store) {
                const state = window.store.getState();
                userId = state.auth.isAuthorized && state.auth.id || '';
            } else if (window.g_user_id) {
                userId = window.g_user_id;
            }
        }

        function quickCheckAndRender() {
            checkUserAuth()
                .then(loadUsers)
                .then(() =>{
                    if(isPromoOver){
                        participateBtns.forEach(el => {
                            el.classList.add('lock');
                        })
                        redirectBtns.forEach(el => {
                            el.classList.add('lock');
                        })
                    }

                    setTimeout(hideLoader, 300);

                    document.querySelectorAll(".table__tabs-item").forEach((tab, i) =>{
                        tab.classList.remove('active');
                        if(i === activeWeek - 1) tab.classList.add('active');
                    })
                    renderUsers(activeWeek, tableData)
                    participateBtns.forEach(btn => btn.addEventListener('click', participate));

                    tableTabs.forEach(tab =>{
                        if(Number(tab.getAttribute("data-week")) > activeWeek){
                            tab.style.pointerEvents = "none";
                        }else{
                            tab.style.pointerEvents = "initial";
                        }

                    })
                    document.addEventListener("click", e =>{
                        if(e.target.closest(".table__tabs-item")){
                            if(Number(e.target.closest(".table__tabs-item").getAttribute("data-week")) > activeWeek) {
                                return
                            }
                            e.target.closest(".table__tabs-item").style.pointerEvents = "initial";
                            tableTabs.forEach(tab =>{
                                tab.classList.remove("active");
                            })
                            let tabWeek = e.target.closest(".table__tabs-item").getAttribute("data-week");
                            e.target.closest(".table__tabs-item").classList.add("active");
                            renderUsers(tabWeek, tableData)
                        }
                    })
                })
        }

        const waitForUserId = new Promise((resolve) => {
            const interval = setInterval(() => {
                tryDetectUserId();
                if (userId || attempts >= maxAttempts) {
                    quickCheckAndRender();
                    clearInterval(interval);
                    resolve();
                }
                attempts++;
            }, attemptInterval);
        });

        await waitForUserId;
    }

    function loadTranslations() {
        return request(`/new-translates/${locale}`)
            .then(json => {
                i18nData = json;
                translate();
            });
    }

    loadTranslations().then(init)

    // iOS custom scrollbar
    const isIOS = (() => {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        const isModernIpad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        return iOS || isModernIpad;
    })();

    function initIOSScrollbars() {
        if (!isIOS) return;

        const scrollContainers = document.querySelectorAll('.drop-txt-list');

        scrollContainers.forEach(container => {
            if (container.dataset.iosScrollbar) return;
            container.dataset.iosScrollbar = 'true';

            container.style.position = 'relative';
            
            // Hide native iOS scrollbar using overflow wrapper technique
            container.style.marginRight = '-20px';
            container.style.paddingRight = '30px';
            container.parentElement.style.overflow = 'hidden';

            const track = document.createElement('div');
            track.className = 'ios-scrollbar-track';

            const thumb = document.createElement('div');
            thumb.className = 'ios-scrollbar-thumb';

            track.appendChild(thumb);
            container.parentElement.style.position = 'relative';
            container.parentElement.appendChild(track);

            function updateThumb() {
                const scrollHeight = container.scrollHeight;
                const clientHeight = container.clientHeight;
                const scrollTop = container.scrollTop;

                if (scrollHeight <= clientHeight) {
                    track.style.display = 'none';
                    return;
                }

                track.style.display = 'block';

                const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 20);
                const maxScrollTop = scrollHeight - clientHeight;
                const thumbTop = (scrollTop / maxScrollTop) * (clientHeight - thumbHeight);

                thumb.style.height = thumbHeight + 'px';
                thumb.style.transform = `translateY(${thumbTop}px)`;
            }

            container.addEventListener('scroll', updateThumb);

            const observer = new MutationObserver(updateThumb);
            observer.observe(container, { childList: true, subtree: true });

            setTimeout(updateThumb, 100);

            container.closest('details')?.addEventListener('toggle', () => {
                setTimeout(updateThumb, 50);
            });
        });
    }

    initIOSScrollbars();

})();
