<!-- src/pages/AboutView.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n()
const appVersion = import.meta.env.VITE_APP_VERSION || '2.0.0'
</script>

<template>
  <div class="about-page-container">
    <h1>
      {{ t('about.title') }}
      <span class="app-version"> ({{ appVersion }})</span>
    </h1>
    <p><strong>EXTRAPAWN</strong>{{ t('about.intro') }}</p>

    <h2>{{ t('about.sections.mainModesTitle') }}</h2>
    <ul>
      <li>
        <strong>{{ t('about.modes.automaticTacticalTrainerTitle') }}</strong
        >{{ t('about.modes.automaticTacticalTrainer') }}
      </li>
      <li>
        <strong>{{ t('about.modes.conversionTitle') }}</strong
        >{{ t('about.modes.conversion') }}
      </li>

      <li>
        <strong>{{ t('about.modes.userCabinetTitle') }}</strong
        >{{ t('about.modes.userCabinet') }}
      </li>
      <li>
        <strong>{{ t('about.modes.analysisPanelTitle') }}</strong
        >{{ t('about.modes.analysisPanel') }}
      </li>
    </ul>

    <h2>{{ t('about.sections.keyFeaturesTitle') }}</h2>
    <ul>
      <li>
        <strong>{{ t('about.features.lichessIntegrationTitle') }}</strong
        >{{ t('about.features.lichessIntegration') }}
      </li>
      <li>
        <strong>{{ t('about.features.advancedStatsTitle') }}</strong
        >{{ t('about.features.advancedStats') }}
      </li>
      <li>
        <strong>{{ t('about.features.puzzleDatabaseTitle') }}</strong
        >{{ t('about.features.puzzleDatabase')
        }}<a href="https://database.lichess.org/#puzzles" target="_blank" rel="noopener noreferrer"
          >https://database.lichess.org/#puzzles</a
        >
      </li>
      <li>
        <strong>{{ t('about.features.modernUITitle') }}</strong
        >{{ t('about.features.modernUI') }}
      </li>
      <li>
        <strong>{{ t('about.features.localizationTitle') }}</strong
        >{{ t('about.features.localization') }}
      </li>
      <li>
        <strong>{{ t('about.modes.botSelectionTitle') }}</strong
        >{{ t('about.modes.botSelectionIntro') }}
        <ul class="bot-list">
          <li><strong>SF-18</strong>{{ t('about.modes.bots.stockfish_2500') }}</li>
          <li><strong>U-2400</strong>{{ t('about.modes.bots["maia-2400"]') }}</li>
          <li><strong>M-2200</strong>{{ t('about.modes.bots["maia-2200"]') }}</li>
          <li><strong>M-1900</strong>{{ t('about.modes.bots["maia-1900"]') }}</li>
        </ul>
      </li>
    </ul>

    <h2>{{ t('about.sections.techStackTitle') }}</h2>
    <ul>
      <li>
        <strong>{{ t('about.techStack.frontend') }}</strong
        >{{ t('about.techStack.frontendStack') }}
      </li>
      <li>
        <strong>{{ t('about.techStack.backend') }}</strong
        >{{ t('about.techStack.backendStack') }}
      </li>
      <li>
        <strong>{{ t('about.techStack.chessLogic') }}</strong
        >{{ t('about.techStack.chessLogicStack') }}
      </li>
      <li>
        <strong>{{ t('about.techStack.boardRendering') }}</strong
        >{{ t('about.techStack.boardRenderingStack') }}
      </li>
      <li>
        <strong>{{ t('about.techStack.chessEngine') }}</strong
        >{{ t('about.techStack.chessEngineStack') }}
      </li>
      <li>
        <strong>{{ t('about.techStack.api') }}</strong
        >{{ t('about.techStack.apiStack')
        }}<a href="https://lichess.org/api" target="_blank" rel="noopener noreferrer"
          >https://lichess.org/api</a
        >)
      </li>
    </ul>

    <h2>{{ t('about.sections.contributingTitle') }}</h2>
    <p>{{ t('about.contributing') }}</p>

    <!-- --- НАЧАЛО ИЗМЕНЕНИЙ: Обновленный раздел лицензий и благодарностей --- -->
    <h2>{{ t('about.sections.licenseAndAcknowledgementsTitle') }}</h2>
    <p>{{ t('about.licenseAndAcknowledgements.gplIntro') }}</p>

    <!-- Stockfish -->
    <h3>{{ t('about.licenseAndAcknowledgements.stockfish.title') }}</h3>
    <p>
      {{ t('about.licenseAndAcknowledgements.stockfish.text1') }}
      <strong>Stockfish</strong>{{ t('about.licenseAndAcknowledgements.stockfish.text2') }}
      <strong>GPLv3</strong>.
    </p>
    <p class="licensing-note">
      <strong>{{ t('about.licenseAndAcknowledgements.stockfish.gplNoteTitle') }}</strong>
      {{ t('about.licenseAndAcknowledgements.stockfish.gplNote') }}
    </p>
    <ul class="licensing-links">
      <li>{{ t('about.licenseAndAcknowledgements.stockfish.projectSourceCode') }}</li>
      <li>
        {{ t('about.licenseAndAcknowledgements.stockfish.licenseText') }}
        <a
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          target="_blank"
          rel="noopener noreferrer"
          >https://www.gnu.org/licenses/gpl-3.0.html</a
        >.
      </li>
    </ul>
    <p>{{ t('about.licenseAndAcknowledgements.stockfish.gratitude') }}</p>

    <!-- Maia Chess -->
    <h3>{{ t('about.licenseAndAcknowledgements.maia.title') }}</h3>
    <p v-html="t('about.licenseAndAcknowledgements.maia.text')"></p>
    <ul class="licensing-links">
      <li>
        <a href="https://www.maiachess.com/" target="_blank" rel="noopener noreferrer">{{
          t('about.licenseAndAcknowledgements.maia.links.website')
        }}</a>
      </li>
      <li>
        <a href="https://github.com/CSSLab/maia-chess" target="_blank" rel="noopener noreferrer">{{
          t('about.licenseAndAcknowledgements.maia.links.github')
        }}</a>
      </li>
      <li>
        <a href="https://lichess.org/@/maia9" target="_blank" rel="noopener noreferrer">{{
          t('about.licenseAndAcknowledgements.maia.links.lichessBot')
        }}</a>
      </li>
    </ul>

    <!-- LCZero -->
    <h3>{{ t('about.licenseAndAcknowledgements.lcZero.title') }}</h3>
    <p v-html="t('about.licenseAndAcknowledgements.lcZero.text')"></p>
    <ul class="licensing-links">
      <li>
        <a href="https://lczero.org/" target="_blank" rel="noopener noreferrer">{{
          t('about.licenseAndAcknowledgements.lcZero.links.website')
        }}</a>
      </li>
      <li>
        <a href="https://github.com/LeelaChessZero/lc0" target="_blank" rel="noopener noreferrer">{{
          t('about.licenseAndAcknowledgements.lcZero.links.github')
        }}</a>
      </li>
    </ul>

    <!-- Chessground -->
    <h3>{{ t('about.licenseAndAcknowledgements.chessground.title') }}</h3>
    <p>
      {{ t('about.licenseAndAcknowledgements.chessground.text1') }}
      <strong>Chessground</strong>
      {{ t('about.licenseAndAcknowledgements.chessground.text2') }}
      {{ t('about.licenseAndAcknowledgements.chessground.gratitude') }}
    </p>

    <!-- Chessops -->
    <h3>{{ t('about.licenseAndAcknowledgements.chessops.title') }}</h3>
    <p>
      <span v-html="t('about.licenseAndAcknowledgements.chessops.text')"></span>
      {{ t('about.licenseAndAcknowledgements.chessops.gratitude') }}
    </p>

    <!-- Other Credits -->
    <h3>{{ t('about.licenseAndAcknowledgements.otherCreditsTitle') }}</h3>
    <ul>
      <li>{{ t('about.licenseAndAcknowledgements.credits.lichess') }}</li>

      <li>{{ t('about.licenseAndAcknowledgements.credits.community') }}</li>
    </ul>
    <!-- --- КОНЕЦ ИЗМЕНЕНИЙ --- -->

    <hr />

    <div class="author-section">
      <img class="author-photo" src="/jpg/me.jpg" :alt="t('about.author.photoAlt')" />
      <div class="author-bio">
        <h2 class="author-title">{{ t('about.author.title') }}</h2>
        <p>{{ t('about.author.bioPart1') }}</p>
        <p>{{ t('about.author.bioPart2') }}</p>
        <p>{{ t('about.author.bioPart3') }}</p>
        <div class="support-button-container">
          <a
            class="support-button"
            href="https://coff.ee/chessboard.fun"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path
                d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.38 2.72 6.13 6.1 6.28H14v-2.28c-2.23-.14-4-1.99-4-4.28V5h10v3h2V5c0-1.1-.9-2-2-2zm-2 13h-4c-1.1 0-2 .9-2 2v2h8v-2c0-1.1-.9-2-2-2z"
              ></path>
            </svg>
            {{ t('about.author.supportButtonText') }}
          </a>
        </div>
      </div>
    </div>

    <hr />

    <div class="contact-info">
      <p>
        {{ t('about.contact.telegram') }}{{ t('about.contact.separator')
        }}<a href="https://t.me/extrapawn_chat" target="_blank" rel="noopener noreferrer"
          >https://t.me/extrapawn_chat</a
        >
      </p>
      <p>
        {{ t('about.contact.email') }}{{ t('about.contact.separator')
        }}<a href="mailto:immozerai@gmail.com">immozerai@gmail.com</a>
      </p>
      <p>
        {{ t('about.contact.github') }}{{ t('about.contact.separator')
        }}<a
          href="https://github.com/ImMoSer/extrapawn.com"
          target="_blank"
          rel="noopener noreferrer"
          >https://github.com/ImMoSer/EXTRAPAWN</a
        >
      </p>
    </div>

    <p class="footer-note">{{ t('about.footerNote') }}</p>
  </div>
</template>

<style scoped>
.about-page-container {
  position: relative;
  padding: 20px 40px;
  box-sizing: border-box;
  background-color: var(--color-bg-secondary);
  color: var(--color-text-default);
  width: 80vw;
  max-width: 1200px;
  margin: 20px auto;
  border-radius: var(--panel-border-radius);
  border: 1px solid var(--color-border-hover);
  font-size: var(--font-size-base);
  line-height: 1.7;
}

.about-page-container .language-switcher-container {
  position: absolute;
  top: 20px;
  right: 20px;
}

.about-page-container h1 {
  font-size: var(--font-size-xxlarge);
  color: var(--color-accent-primary);
  text-align: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border-hover);
  padding-bottom: 15px;
}

.about-page-container h2 {
  font-size: var(--font-size-xlarge);
  color: var(--color-accent-success);
  margin-top: 30px;
  margin-bottom: 15px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--color-border);
}

.about-page-container h3 {
  font-size: var(--font-size-large);
  color: var(--color-accent-warning);
  margin-top: 20px;
  margin-bottom: 10px;
}

.about-page-container p,
.about-page-container li {
  color: var(--color-text-muted);
}

.about-page-container strong {
  color: var(--color-text-default);
  font-weight: var(--font-weight-bold);
}

.about-page-container a {
  color: var(--color-text-link);
  text-decoration: none;
}

.about-page-container a:hover {
  text-decoration: underline;
}

.about-page-container ul {
  list-style-type: '–  ';
  padding-left: 20px;
  margin-top: 0;
}

.about-page-container ul li {
  margin-bottom: 8px;
  padding-left: 10px;
}

.bot-list {
  margin-top: 10px;
  padding-left: 25px;
}

.bot-list li {
  margin-bottom: 5px;
}

.about-page-container .licensing-note {
  background-color: rgba(252, 98, 9, 0.1);
  border-left: 4px solid var(--color-accent-warning);
  padding: 15px;
  margin: 15px 0;
  border-radius: 4px;
}

.about-page-container .support-button-container {
  text-align: center;
  margin: 30px 0;
}

.about-page-container .support-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 28px;
  background-color: #ffdd00;
  color: #000000;
  text-decoration: none;
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  border-radius: 12px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.about-page-container .support-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.about-page-container .support-button svg {
  width: 1.2em;
  height: 1.2em;
}

.about-page-container hr {
  border: none;
  border-top: 1px solid var(--color-border-hover);
  margin: 40px 0;
}

.author-section {
  display: flex;
  align-items: center;
  gap: 30px;
  margin: 40px 0;
  background-color: var(--color-bg-primary);
  padding: 25px;
  border-radius: var(--panel-border-radius);
  border: 1px solid var(--color-border);
}

.author-photo {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--color-accent-primary);
  flex-shrink: 0;
}

.author-bio {
  flex-grow: 1;
}

.author-bio .author-title {
  border-bottom: none;
  margin-top: 0;
  color: var(--color-accent-primary);
}

.about-page-container .contact-info {
  text-align: center;
  margin-bottom: 20px;
}

.about-page-container .contact-info p {
  margin: 5px 0;
}

.about-page-container .footer-note {
  text-align: center;
  font-style: italic;
  color: var(--color-text-muted);
  margin-top: 30px;
}

@media (max-width: 768px) {
  .about-page-container {
    width: 100%;
    padding: 15px;
    font-size: var(--font-size-small);
  }

  .about-page-container .language-switcher-container {
    top: 10px;
    right: 10px;
  }

  .author-section {
    flex-direction: column;
    text-align: center;
    padding: 20px;
    gap: 20px;
  }

  .author-photo {
    width: 120px;
    height: 120px;
  }

  .about-page-container h1 {
    font-size: var(--font-size-xlarge);
  }

  .about-page-container h2 {
    font-size: var(--font-size-large);
  }

  .about-page-container h3 {
    font-size: var(--font-size-base);
  }
}
</style>
