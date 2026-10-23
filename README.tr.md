# changelog-guard

[![CI](https://github.com/YusufBeratZengin/changelog-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/changelog-guard/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![npm sürümü](https://img.shields.io/npm/v/changelog-guard.svg)](https://www.npmjs.com/package/changelog-guard)

Changelog dosyanızı denetleyin, çekme isteklerinde sürüm notu arayın ve çalışma zamanı bağımlılığı olmadan sürüm hazırlayın.

[English](README.md) · [Katkı rehberi](CONTRIBUTING.md) · [Hata bildir](https://github.com/YusufBeratZengin/changelog-guard/issues/new/choose)

![Gerçek CLI çıktısı: hatalı sürüm tarihinin kural adı ve dosya konumuyla JSON biçiminde bildirilmesi.](docs/demo.svg)

## Neden?

- **Tek işe odaklanır:** [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) başlıklarını, tarihlerini, bağlantılarını ve değişiklik türlerini; [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) sürüm sıralamasını denetler.
- **Sürüm notları kodla birlikte ilerler:** `check-pr`, seçilen kaynak dosyalar değiştiğinde `[Unreleased]` bölümüne ekleme yapılmasını ister. İstisnalar etiket veya commit trailer ile açıkça belirtilir.
- **Kurulumu hafiftir:** çalışma zamanı bağımlılığı ve zorunlu yapılandırma dosyası yoktur. Sürüm hazırlarken mevcut satır sonlarını ve ilgisiz içeriği korur.

## Hızlı başlangıç

**Node.js 20+** ve **Git** gerekir (`check-pr` için Git geçmişi de yerelde bulunmalıdır). Kaynak kodu klonlayıp çalıştırabilirsiniz; kurulum adımı veya yayımlanmış npm paketi gerekmez:

```bash
git clone https://github.com/YusufBeratZengin/changelog-guard.git
cd changelog-guard
node bin/changelog-guard.js --version
node bin/changelog-guard.js lint CHANGELOG.md
```

Son iki komutun beklenen çıktısı:

```text
0.1.0
CHANGELOG is valid. No issues found in CHANGELOG.md
```

npm rozeti kayıt defterindeki durumu gösterir; ilk yayımdan önce sürüm bilgisi bulunamayabilir. Kaynak koddan çalıştırma, npm yayımından bağımsızdır.

## Kullanım örnekleri

Aşağıdaki komutları depo kökünde çalıştırın. Tüm seçenekler için `node bin/changelog-guard.js --help` komutunu kullanın.

### Denetleme

```bash
node bin/changelog-guard.js lint
node bin/changelog-guard.js lint docs/CHANGELOG.md
node bin/changelog-guard.js lint --allow-empty-unreleased
node bin/changelog-guard.js lint --no-require-unreleased
node bin/changelog-guard.js lint --check-orphans
```

Demoyu, bilerek hatalı hazırlanmış test dosyasıyla tekrar üretebilirsiniz. Bu komut **1** çıkış koduyla sonlanır; `non-iso-date` hatasını satır ve sütun bilgisiyle verir:

```bash
node bin/changelog-guard.js lint test/fixtures/invalid-date-changelog.md --format json
```

Denetim kuralları: `heading-structure`, `unknown-change-type`, `non-iso-date`, `versions-not-descending`, `invalid-semver`, `duplicate-version`, `missing-link-reference`, `empty-section` ve `unreleased-missing`. İsteğe bağlı `orphan-link-reference` bildirimleri uyarı düzeyindedir.

### Çekme isteğini kontrol etme

Commit edilmiş değişiklikleri yerelde bulunan bir temel Git referansıyla karşılaştırın:

```bash
node bin/changelog-guard.js check-pr --base origin/main
node bin/changelog-guard.js check-pr --base origin/main --head HEAD --user-facing "src/**,lib/**,packages/**" --ignore "**/*.test.js,**/*.spec.ts"
```

Bilinçli bir istisna için commit mesajının gövdesine `Changelog: skip`, mesajın içine `[skip changelog]` gibi bir işaret veya çekme isteğine yapılandırılmış bir etiket ekleyin. GitHub olay verisindeki etiketler otomatik okunur; Actions dışında `--labels no-changelog` kullanabilirsiniz.

### Sürüm hazırlama

Önce sonucu önizleyin; dosyaya yazmak için `--dry-run` seçeneğini kaldırın:

```bash
node bin/changelog-guard.js release 0.2.0 --date 2026-10-23 --dry-run
```

`release`, `[Unreleased]` maddelerini tarihli sürüm başlığına taşır ve karşılaştırma bağlantılarını günceller. Yalnızca changelog dosyasını düzenler; etiketleme ve paket yayımlama bakımcının ayrı adımlarıdır.

### Changelog oluşturma

```bash
node bin/changelog-guard.js init docs/CHANGELOG.md
```

Üst dizin önceden bulunmalıdır. `init`, mevcut dosyanın üzerine yazmaz.

### GitHub Action

```yaml
name: Changelog
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: YusufBeratZengin/changelog-guard@main
        with:
          mode: both
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}
```

Örnek, sürüm etiketine bağlı kalmamak için `main` kullanır. Tekrarlanabilir derlemeler için Action'ı incelenmiş bir commit'e sabitleyin. Temel ve karşılaştırılan commit'lerin geçmişini çekin; composite Action'dan önce Node.js kurulumunu yapın.

### JavaScript API

Aynı işlemler kaynak koddan ES modülü olarak da kullanılabilir:

```javascript
import { readFileSync } from 'node:fs';
import { lintChangelog, executeRelease } from './src/index.js';

const content = readFileSync('CHANGELOG.md', 'utf8');
const result = lintChangelog(content);
console.log(result.valid, result.diagnostics);

const preview = executeRelease(content, '0.2.0', { date: '2026-10-23' });
console.log(preview.content); // Metin döndürür; dosyaya yazmaz.
```

Giriş modülü ayrıca ayrıştırıcıyı, dosya üzerinden sürüm hazırlama işlevini, çıktı biçimlendiricilerini ve `semver` ile `glob` yardımcılarını dışa aktarır. Tam liste için [src/index.js](src/index.js) dosyasına bakın.

## Yapılandırma

CLI, komut seçenekleriyle yapılandırılır; ayrı yapılandırma dosyası yoktur.

| Komut | Seçenek | Varsayılan / davranış |
| --- | --- | --- |
| `lint` | `[file]` veya `--file` | `CHANGELOG.md` |
| `lint` | `--format` | `stylish`; otomasyon için `json` |
| `lint` | `--allow-empty-unreleased` | Kapalı; sürüm hazırladıktan sonra boş sürüm bölümüne izin verir |
| `lint` | `--no-require-unreleased` | Kapalı; `[Unreleased]` zorunluluğunu kaldırır |
| `lint` | `--check-orphans` | Kapalı; kullanılmayan sürüm bağlantılarını uyarı olarak bildirir |
| `check-pr` | `--base` / `--head` | Temel referans zorunlu / `HEAD` |
| `check-pr` | `--file` | `CHANGELOG.md` |
| `check-pr` | `--user-facing` | `src/**,lib/**` |
| `check-pr` | `--ignore` | `**/*.test.*,**/*.spec.*,**/test/**,**/tests/**,**/*.d.ts,**/*.map` |
| `check-pr` | `--skip-trailer` | `Changelog: skip` |
| `check-pr` | `--skip-labels` | `no-changelog,skip-changelog,chore,dependencies` |
| `check-pr` | `--labels` | Önce `PR_LABELS`, ardından `GITHUB_EVENT_PATH` içindeki etiketler |
| `release` | `--file` / `--date` | `CHANGELOG.md` / yerel takvime göre bugün (`YYYY-MM-DD`) |
| `release` | `--dry-run` | Kapalı; güncellenmiş dosyayı yazmadan ekrana verir |

Action; `mode` (`both`, `lint` veya `check-pr`), `file`, `base`, `head`, `user-facing`, `ignore`, `skip-trailer`, `skip-labels` ve `allow-empty-unreleased` girdilerini kabul eder. Kesin varsayılanlar için [action.yml](action.yml) dosyasına bakın; Action'ın hariç tutma listesinde `**/*.map` bulunmaz. Composite Action içindeki `check-pr`, yalnızca `pull_request` olaylarında çalışır.

## Sık sorulanlar / Sınırlar

**Çıkış kodları ne anlama gelir?** Denetim hataları, başarısız çekme isteği kontrolleri ve komut hataları `1`; başarılı kontroller ve açıkça atlanan kontroller `0` döndürür. Tek başına kullanılmayan bağlantı uyarıları denetimi başarısız kılmaz.

**`[Unreleased]` boş kalabilir mi?** Yeni sürümden sonra `--allow-empty-unreleased` kullanın. Boş `### Added` veya diğer değişiklik türü başlıkları yine hatadır; kullanılmayan başlıkları kaldırın.

**`check-pr`, değişikliğin içeriğini anlar mı?** Dosya desenlerini eşleştirir; `[Unreleased]` altında yeni madde metni veya değişen açıklama arar. Notun kodu doğru anlatıp anlatmadığını değerlendirmez. Commit edilmiş Git referanslarını karşılaştırır, changelog dosyasını çalışma dizininden okuyabilir; CI'da temiz bir çalışma kopyası kullanın.

**Hangi dosya desenleri desteklenir?** `*`, `**`, `?` ve API'de basit süslü parantez açılımı desteklenir. CLI listeleri virgülle ayrılır; virgül içeren süslü parantez yerine `src/**,lib/**` yazın. Hariç tutmak için `--ignore` kullanın. Eşleştirici, shell veya gitignore kurallarının tamamını uygulamaz.

**Sürüm hazırlarken her tarih doğrulanır mı?** `lint`, gerçek takvim tarihlerini denetler. `release --date` da `2026-13-45` gibi geçersiz tarihleri reddeder. Yaygın karşılaştırma bağlantıları güncellenir; özel barındırma adreslerini `--dry-run` ile gözden geçirin.

**Token veya dış servis gerekir mi?** CLI yerelde çalışır. CI kapsam raporu Node'un yerleşik test çalıştırıcısını kullanır; yapılandırılacak harici kapsam servisi yoktur.

## Katkıda bulunma

İş akışı için [CONTRIBUTING.md](CONTRIBUTING.md), güvenlik açığı bildirimleri için [SECURITY.md](SECURITY.md) dosyasına bakın. Kaynak kodu klonladıktan sonra:

```bash
npm test
npm run lint
npm run demo
npm run demo:check
```

`npm test`, satır, dal ve işlev kapsamını ekrana yazar. CI, Linux ve Windows üzerinde Node.js 22 ve 24 ile çalışır; `src/**` için en az %85 satır kapsamı ister. CI kapsam kontrolünü Node.js 22.8+ ile yerelde çalıştırabilirsiniz:

```bash
npm test -- --test-coverage-include=src/** --test-coverage-lines=85
```

Testlerde geçici Git depoları kullanıldığı için Git kurulu olmalıdır. JavaScript projesinde şu anda ayrı bir typecheck komutu yoktur. İki README'yi aynı yapıda tutun; demo komutu veya çıktısı değiştiğinde [scripts/make-demo.mjs](scripts/make-demo.mjs) ile [docs/demo.svg](docs/demo.svg) dosyasını yeniden üretin. `npm run demo:check`, görseli dosyaya yazmadan doğrular.

## Lisans

[MIT](LICENSE).
