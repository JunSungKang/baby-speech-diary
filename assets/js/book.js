/**
 * 책 레이아웃 로직 (DOM 파싱 및 뷰 토글 지원)
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
        nextBtn: null
    },

    isTransitioning: false,
    debounceTimer: null
};

// ============================================
// 2. 초기화
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    enhanceMarkdownTables(); // 리스트 뷰 테이블 스타일 개선
    parseDataFromDOM(); // HTML DOM에서 데이터 추출
    setupEventListeners();
    
    // URL 해시 체크 제거 -> 항상 책 뷰 활성화
    renderCurrentSpread();
});

/**
 * 리스트 뷰의 테이블을 반응형 카드 스타일로 변환
 */
function enhanceMarkdownTables() {
    const tables = document.querySelectorAll('#markdown-content table');
    tables.forEach(table => {
        table.classList.add('card-table');
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (headers[index]) {
                    cell.setAttribute('data-label', headers[index]);
                }
            });
        });
    });
}

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
        nextBtn: document.getElementById('next-btn')
    };
}

// ============================================
// 3. 데이터 파싱 (DOM 기반)
// ============================================
/**
 * #markdown-content 내부의 HTML 요소들을 순회하며 Spread 데이터 추출
 */
function parseDataFromDOM() {
    const content = document.getElementById('markdown-content');
    if (!content) {
        console.warn('#markdown-content element not found');
        return;
    }

    const spreads = [];
    let currentSpread = null;

    // content의 직계 자식 노드 순회
    // content의 직계 자식 노드 순회
    Array.from(content.children).forEach(node => {
        // 1. 새로운 Spread 섹션 시작 (H2 태그)
        if (node.tagName === 'H2') {
            if (currentSpread) {
                spreads.push(currentSpread);
            }
            currentSpread = {
                title: node.textContent, // "Spread 1" 등
                memo: null,
                photo: null,
                words: []
            };
        }
        
        // 2. 메타데이터 (P 태그 내 [메모:...], [사진:...])
        else if (node.tagName === 'P' && currentSpread) {
            const text = node.textContent.trim();
            
            // 메모 파싱 (여러 개가 같은 줄에 있을 수 있으므로 정규식 각각 체크)
            const memoMatch = text.match(/\[메모:\s*(.*?)\]/);
            if (memoMatch) {
                currentSpread.memo = memoMatch[1].trim();
            }
            
            // 사진 파싱
            const photoMatch = text.match(/\[사진:\s*(.*?)\]/);
            if (photoMatch) {
                currentSpread.photo = photoMatch[1].trim();
            }
        }
        
        // 3. 단어 데이터 (Table 태그)
        else if (node.tagName === 'TABLE' && currentSpread) {
            const words = parseHTMLTable(node);
            currentSpread.words = words;
        }
    });

    // 마지막 Spread 추가
    if (currentSpread) {
        spreads.push(currentSpread);
    }

    BookApp.spreads = spreads;
    BookApp.totalSpreads = spreads.length;
    
    console.log(`DOM 파싱 완료: ${BookApp.totalSpreads} spreads`);
}

/**
 * HTML Table 요소를 파싱하여 단어 배열 반환
 */
function parseHTMLTable(table) {
    const words = [];
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
            const word = cells[0].textContent.trim();
            const first = cells[1].textContent.trim();
            const developed = [];
            
            // 3번째 컬럼부터는 발전 발음
            for (let i = 2; i < cells.length; i++) {
                const text = cells[i].textContent.trim();
                if (text) developed.push(text);
            }
            
            words.push({ word, first, developed });
        }
    });
    
    return words;
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
}

function openBookView() {
    if (BookApp.elements.listView) BookApp.elements.listView.classList.remove('active');
    if (BookApp.elements.bookView) BookApp.elements.bookView.classList.add('active');
    
    // 데이터가 파싱되지 않았으면 파시 시도 (혹시 모를 경우 대비)
    if (BookApp.spreads.length === 0) {
        parseDataFromDOM();
    }
    
    renderCurrentSpread(); 
    history.pushState(null, null, '#book');
    window.scrollTo(0, 0);
}

function closeBookView() {
    if (BookApp.elements.bookView) BookApp.elements.bookView.classList.remove('active');
    if (BookApp.elements.listView) BookApp.elements.listView.classList.add('active');
    history.pushState(null, null, ' '); // hash 제거
}

// ============================================
// 5. 책 네비게이션 로직 (기존 로직 유지)
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
    if (spreadData) {
        // 단어 목록 렌더링
        renderWordList(spreadData.words, (BookApp.currentSpreadIndex * BookApp.wordsPerPage) + 1);

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
    }
    
    // 페이지 번호 업데이트
    if (BookApp.elements.leftPageNumber) {
        BookApp.elements.leftPageNumber.textContent = (BookApp.currentSpreadIndex * 2) + 2;
    }
    if (BookApp.elements.rightPageNumber) {
        BookApp.elements.rightPageNumber.textContent = (BookApp.currentSpreadIndex * 2) + 3;
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
    const totalPronunciations = 1 + wordData.developed.length;
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
    
    wordData.developed.forEach(dev => {
        html += `
            <div class="word-tertiary">
                <span class="word-prefix">→ 발전: </span>
                <span class="word-text">${escapeHtml(dev)}</span>
            </div>
        `;
    });
    div.innerHTML = html;
    return div;
}

function escapeHtml(text) {
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
    
    switch(event.key) {
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
