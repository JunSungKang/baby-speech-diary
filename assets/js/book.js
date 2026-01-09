/**
 * 책 레이아웃 로직 (JSON 데이터 파싱 및 뷰 토글 지원)
 */

// ============================================
// 1. 전역 상태 관리
// ============================================
const BookApp = {
    spreads: [], // { memo: string, photo: string, words: Array }
    currentSpreadIndex: 0,
    totalSpreads: 0,
    wordsPerPage: 10,

    // UI Elements
    elements: {
        listView: null,
        bookView: null,
        btnOpenBook: null,
        btnCloseBook: null,
        bookContainer: null,
        leftPage: null,
        rightPage: null,
        wordList: null,
        leftPageNumber: null,
        rightPageNumber: null,
        prevBtn: null,
        nextBtn: null,
        btnCloseWarning: null
    },

    isTransitioning: false,
    debounceTimer: null
};

// ============================================
// 2. 초기화
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    parseDataFromDOM(); // 이름은 유지하되 내부는 JSON 처리로 변경
    setupEventListeners();

    // URL 해시 체크 제거 -> 항상 책 뷰 활성화
    renderCurrentSpread();
});


function initializeElements() {
    BookApp.elements = {
        listView: document.getElementById('list-view'),
        bookView: document.getElementById('book-view'),
        btnOpenBook: document.getElementById('btn-open-book'),
        btnCloseBook: document.getElementById('btn-close-book'),
        bookContainer: document.getElementById('book-container'),
        leftPage: document.querySelector('.page-left'),
        rightPage: document.querySelector('.page-right'),
        wordList: document.getElementById('word-list'),
        leftPageNumber: document.getElementById('left-page-number'),
        rightPageNumber: document.getElementById('right-page-number'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        btnCloseWarning: document.getElementById('btn-close-warning')
    };
}

// ============================================
// 3. 데이터 파싱 (JSON 기반)
// ============================================
/**
 * speech.json 데이터를 Script 태그에서 파싱 (IDE 에러 방지)
 */
function parseDataFromDOM() {
    const dataEl = document.getElementById('speech-data');
    if (!dataEl) {
        console.warn('#speech-data element not found');
        return;
    }

    let rawData;
    try {
        rawData = JSON.parse(dataEl.textContent);
    } catch (e) {
        console.error('Failed to parse speech data', e);
        return;
    }

    if (!Array.isArray(rawData)) {
        console.warn('speechData is invalid');
        return;
    }

    // 데이터 검증 및 변환
    BookApp.spreads = rawData.map(item => {
        // 커버 타입
        if (item.type === 'cover') {
            return {
                type: 'cover',
                title: item.title || '표지',
                prologue: item.prologue || '',
                toc: []
            };
        }
        // 콘텐츠 타입
        return {
            type: 'content',
            title: `Spread ${item.id}`,
            memo: item.memo,
            photo: item.photo,
            words: item.words || []
        };
    });

    BookApp.totalSpreads = BookApp.spreads.length;
    console.log(`데이터 로드 완료: ${BookApp.totalSpreads} spreads`);
}

// ============================================
// 4. 이벤트 핸들링 (뷰 전환 및 페이지 이동)
// ============================================
function setupEventListeners() {
    // 뷰 전환
    if (BookApp.elements.btnOpenBook) {
        BookApp.elements.btnOpenBook.addEventListener('click', openBookView);
    }
    if (BookApp.elements.btnCloseBook) {
        BookApp.elements.btnCloseBook.addEventListener('click', closeBookView);
    }

    // 키보드/마우스/버튼
    document.addEventListener('keydown', handleKeyboard);

    if (BookApp.elements.leftPage) {
        BookApp.elements.leftPage.addEventListener('click', handleLeftPageClick);
    }
    if (BookApp.elements.rightPage) {
        BookApp.elements.rightPage.addEventListener('click', handleRightPageClick);
    }

    if (BookApp.elements.prevBtn) {
        BookApp.elements.prevBtn.addEventListener('click', () => navigateToSpread(BookApp.currentSpreadIndex - 1));
    }
    if (BookApp.elements.nextBtn) {
        BookApp.elements.nextBtn.addEventListener('click', () => navigateToSpread(BookApp.currentSpreadIndex + 1));
    }

    // 모바일 경고창 닫기 버튼 이벤트
    if (BookApp.elements.btnCloseWarning) {
        BookApp.elements.btnCloseWarning.addEventListener('click', closeMobileWarning);
    }
}

function closeMobileWarning() {
    const warningEl = document.getElementById('mobile-warning');
    if (warningEl) {
        warningEl.style.display = 'none';
        document.body.style.overflow = 'auto'; // 스크롤 허용
    }
}

function openBookView() {
    if (BookApp.elements.listView) BookApp.elements.listView.classList.remove('active');
    if (BookApp.elements.bookView) BookApp.elements.bookView.classList.add('active');

    // 데이터가 파싱되지 않았으면 파시 시도 (혹시 모를 경우 대비)
    if (!BookApp.spreads || BookApp.spreads.length === 0) {
        parseDataFromDOM();
    }

    renderCurrentSpread();
    history.pushState(null, null, '#book');
    window.scrollTo(0, 0);
}

function closeBookView() {
    // 기능 제거됨 (항상 Book View)
}

// ============================================
// 5. 책 네비게이션 로직
// ============================================

function navigateToSpread(spreadIndex) {
    // 디바운스
    if (BookApp.debounceTimer) {
        clearTimeout(BookApp.debounceTimer);
    }

    BookApp.debounceTimer = setTimeout(() => {
        executeNavigation(spreadIndex);
    }, 50);
}

function executeNavigation(spreadIndex) {
    if (spreadIndex < 0 || spreadIndex >= BookApp.totalSpreads) return;
    if (spreadIndex === BookApp.currentSpreadIndex) return;

    BookApp.isTransitioning = true;
    BookApp.currentSpreadIndex = spreadIndex;
    renderCurrentSpread();
    updateNavigation();
    BookApp.isTransitioning = false;
}

function renderCurrentSpread() {
    if (!BookApp.spreads || BookApp.spreads.length === 0) return;

    const spreadData = BookApp.spreads[BookApp.currentSpreadIndex];
    if (!spreadData) return;

    // UI 요소 찾기
    const leftPage = BookApp.elements.leftPage;
    const rightPage = BookApp.elements.rightPage;

    const coverLayer = leftPage.querySelector('.cover-layer');
    const contentLayerLeft = leftPage.querySelector('.content-layer');

    const introLayer = rightPage.querySelector('.intro-layer');
    const contentLayerRight = rightPage.querySelector('.content-layer');

    // 1. 커버 페이지 (Index 0)
    if (spreadData.type === 'cover') {
        // 레이어 토글
        if (coverLayer) coverLayer.style.display = 'flex';
        if (contentLayerLeft) contentLayerLeft.style.display = 'none';

        if (introLayer) introLayer.style.display = 'block';
        if (contentLayerRight) contentLayerRight.style.display = 'none';

        // 데이터 주입 (프롤로그/목차)
        const prologueEl = document.getElementById('prologue-text');
        if (prologueEl) prologueEl.innerText = spreadData.prologue; // textContent -> innerText (줄바꿈 지원)

    }
    // 2. 일반 콘텐츠 페이지 (Index 1+)
    else {
        // 레이어 토글
        if (coverLayer) coverLayer.style.display = 'none';
        if (contentLayerLeft) contentLayerLeft.style.display = 'flex'; // flex 주의

        if (introLayer) introLayer.style.display = 'none';
        if (contentLayerRight) contentLayerRight.style.display = 'block'; // block/flex 주의 (기존 css 확인 필요)

        // 단어 목록 렌더링
        // Index 0이 Cover이므로, Index 1이 첫 단어(1번) 시작.
        // 공식: (CurrentIndex - 1) * 10 + 1
        const startIndex = ((BookApp.currentSpreadIndex - 1) * BookApp.wordsPerPage) + 1;
        renderWordList(spreadData.words, startIndex);

        // 메모 렌더링
        const memoEl = document.querySelector('.memo-area .memo-placeholder');
        if (memoEl) {
            memoEl.textContent = spreadData.memo || "메모";
        }

        // 사진 렌더링
        const photoTextEl = document.querySelector('.photo-placeholder .placeholder-text');
        if (photoTextEl) {
            photoTextEl.textContent = spreadData.photo ? `사진: ${spreadData.photo}` : "사진 삽입 영역";
        }

        // 페이지 번호 업데이트
        const pLeft = BookApp.currentSpreadIndex * 2;
        const pRight = BookApp.currentSpreadIndex * 2 + 1;

        if (BookApp.elements.leftPageNumber) BookApp.elements.leftPageNumber.textContent = pLeft;
        if (BookApp.elements.rightPageNumber) BookApp.elements.rightPageNumber.textContent = pRight;
    }

    updateNavigation();
}

function renderWordList(words, startIndex) {
    if (!BookApp.elements.wordList) return;
    BookApp.elements.wordList.innerHTML = '';

    // 1. 실제 단어 렌더링
    words.forEach((wordData, index) => {
        const wordItem = createWordElement(wordData, startIndex + index);
        BookApp.elements.wordList.appendChild(wordItem);
    });

    // 2. 빈 줄 채우기 (항상 10줄 유지)
    const MAX_ROWS = 10;
    const remaining = MAX_ROWS - words.length;
    if (remaining > 0) {
        for (let i = 0; i < remaining; i++) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'word-item empty-slot'; // empty-slot 클래스 추가
            // 빈 공간에도 줄을 긋기 위해 스타일 유지
            BookApp.elements.wordList.appendChild(emptyItem);
        }
    }
}

function createWordElement(wordData, number) {
    const div = document.createElement('div');
    div.className = 'word-item';

    // Overflow 처리
    const totalPronunciations = 1 + (wordData.developed ? wordData.developed.length : 0);
    if (totalPronunciations >= 5) div.classList.add('overflow-5');
    else if (totalPronunciations >= 4) div.classList.add('overflow-4');

    let html = `
        <div class="word-primary">
            <span class="word-number">${number}.</span>
            <span class="word-text">${escapeHtml(wordData.word)}</span>
        </div>
        <div class="word-secondary">
            <span class="word-prefix">→ 처음: </span>
            <span class="word-text">${escapeHtml(wordData.first)}</span>
        </div>
    `;

    if (wordData.developed) {
        wordData.developed.forEach(dev => {
            html += `
                <div class="word-tertiary">
                    <span class="word-prefix">→ 발전: </span>
                    <span class="word-text">${escapeHtml(dev)}</span>
                </div>
            `;
        });
    }
    div.innerHTML = html;
    return div;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateNavigation() {
    if (BookApp.elements.prevBtn) {
        BookApp.elements.prevBtn.disabled = BookApp.currentSpreadIndex === 0;
    }
    if (BookApp.elements.nextBtn) {
        BookApp.elements.nextBtn.disabled = BookApp.currentSpreadIndex === BookApp.totalSpreads - 1;
    }

    // 첫/마지막 페이지 클래스 처리 (선택)
    if (BookApp.elements.leftPage) {
        if (BookApp.currentSpreadIndex === 0) BookApp.elements.leftPage.classList.add('first-page');
        else BookApp.elements.leftPage.classList.remove('first-page');
    }
    if (BookApp.elements.rightPage) {
        if (BookApp.currentSpreadIndex === BookApp.totalSpreads - 1) BookApp.elements.rightPage.classList.add('last-page');
        else BookApp.elements.rightPage.classList.remove('last-page');
    }
}

// 키보드/마우스 공통 로직 (기존 로직 단순화)
function handleKeyboard(event) {
    if (!BookApp.elements.bookView.classList.contains('active')) return;
    if (BookApp.isTransitioning) return;

    switch (event.key) {
        case 'ArrowRight': event.preventDefault(); navigateToSpread(BookApp.currentSpreadIndex + 1); break;
        case 'ArrowLeft': event.preventDefault(); navigateToSpread(BookApp.currentSpreadIndex - 1); break;
        case 'Home': event.preventDefault(); navigateToSpread(0); break;
        case 'End': event.preventDefault(); navigateToSpread(BookApp.totalSpreads - 1); break;
        case 'Escape': closeBookView(); break;
    }
}

function handleLeftPageClick(event) {
    if (BookApp.isTransitioning) return;
    if (BookApp.currentSpreadIndex > 0) navigateToSpread(BookApp.currentSpreadIndex - 1);
}

function handleRightPageClick(event) {
    if (BookApp.isTransitioning) return;
    if (BookApp.currentSpreadIndex < BookApp.totalSpreads - 1) navigateToSpread(BookApp.currentSpreadIndex + 1);
}
