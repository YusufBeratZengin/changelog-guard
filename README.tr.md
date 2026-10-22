# changelog-guard

[Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) standardına uygun `CHANGELOG.md` dosyalarını denetleyen ve CI ortamlarında kullanıcıyı ilgilendiren değişikliklerin sürüm notu içermesini zorunlu kılan, sıfır bağımlılıklı araç seti.

## Genel Bakış

Yazılım projelerinde katkıcılar kullanıcıyı etkileyen değişiklikler yaptığında sürüm notları sıklıkla güncellenmez ve zamanla eskir. semantic-release veya changesets gibi kapsamlı yayın araçları ise ek yapılandırma yükü, harici bağımlılıklar ve farklı git iş akışları gerektirir.

`changelog-guard` bu soruna hafif ve odaklanmış bir çözüm sunar:
1. `CHANGELOG.md` dosyasının Keep a Changelog 1.1 ve Semantic Versioning 2.0.0 kurallarına tam uyumunu denetler.
2. Çekme isteklerinde (Pull Request) kullanıcıyı etkileyen kaynak kod değişikliklerinin `[Unreleased]` başlığı altında belgelenip belgelenmediğini doğrular.
3. Yeni sürüm hazırlığında `[Unreleased]` maddelerini tarihli bir sürüm başlığına taşır ve karşılaştırma bağlantılarını dosya düzenini bozmadan günceller.

## Özellikler

- **Sıfır Çalışma Zamanı Bağımlılığı**: Tamamen modern Node.js standart kütüphaneleriyle yazılmıştır.
- **Keep a Changelog 1.1 Uyumluluğu**: Belirtimdeki tüm standart bölümleri ve değişiklik türlerini eksiksiz ayrıştırır ve doğrular.
- **Kapsamlı Denetim Kuralları**:
  - `heading-structure`: H1 başlık, H2 sürüm ve H3 değişiklik türü hiyerarşisini denetler; geçersiz başlık atlamalarını engeller.
  - `unknown-change-type`: Değişiklik türlerini kesin olarak `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` ve `Security` ile sınırlandırır.
  - `non-iso-date`: Sürümlerin ISO 8601 `YYYY-AA-GG` biçiminde geçerli bir takvim tarihi içermesini şart koşar.
  - `versions-not-descending`: Sürümlerin SemVer 2.0.0 öncelik sırasına göre azalan düzende listelendiğini doğrular.
  - `invalid-semver`: Sürüm etiketlerinin geçerli semantik sürüm biçiminde olduğunu kontrol eder.
  - `duplicate-version`: Yinelenen sürüm başlıklarını tespit eder.
  - `missing-link-reference`: Köşeli parantezli sürümlerin dosya sonunda karşılık gelen bağlantı tanımlarına sahip olmasını denetler.
  - `empty-section`: İçi boş bırakılmış değişiklik türlerini ve sürümleri işaretler.
  - `unreleased-missing`: Sürüm geçmişinin en başında `## [Unreleased]` bölümünün bulunmasını zorunlu tutar.
- **CI Doğrulaması (`check-pr`)**:
  - Hedef dalla olan `git diff` farkını inceler.
  - Kullanıcıyı ilgilendiren kod değişikliklerini (ör. `src/**`, `lib/**`) saptar.
  - `CHANGELOG.md` dosyasının `[Unreleased]` bölümüne yeni madde eklenip eklenmediğini kontrol eder.
  - İlgili durumlarda kontrolü atlamak için commit trailer (`Changelog: skip`) ve PR etiketlerini (`no-changelog`, `chore`) destekler.
- **Sürüm Yönetimi (`release`)**:
  - `[Unreleased]` maddelerini yeni tarihli bir sürüme dönüştürür.
  - Karşılaştırma bağlantılarını ve etiket URL'lerini otomatik günceller.
  - Satır sonu karakterlerini (CRLF veya LF) ve dosyadaki diğer tüm kısımları aynen korur.
- **Hazır GitHub Action**: CI iş akışlarına doğrudan dahil edilebilen composite eylem.

## Gereksinimler

- Node.js >= 20.0.0
- Git (`check-pr` komutu için)

## Kurulum

`npx` ile doğrudan çalıştırılabilir:

```bash
npx changelog-guard lint
```

Veya projeye geliştirme bağımlılığı olarak eklenebilir:

```bash
npm install --save-dev changelog-guard
```

## CLI Kullanımı

### 1. `lint`

`CHANGELOG.md` dosyasını yapısal ve anlamsal kurallara göre denetler.

```bash
# Geçerli dizindeki CHANGELOG.md dosyasını denetler
changelog-guard lint

# Belirli bir dosyayı denetler
changelog-guard lint docs/CHANGELOG.md

# Sonuçları JSON biçiminde verir
changelog-guard lint --format json

# Boş [Unreleased] bölümüne izin verir (ör. yeni yayından hemen sonra)
changelog-guard lint --allow-empty-unreleased

# [Unreleased] bölümü zorunluluğunu kaldırır
changelog-guard lint --no-require-unreleased
```

### 2. `check-pr`

Çekme isteklerinde kullanıcıyı etkileyen değişikliklerin `[Unreleased]` bölümünde yer aldığını doğrular.

```bash
# origin/main dalına göre temel kontrol
changelog-guard check-pr --base origin/main

# Özel dosya desenleri ve hariç tutulan yollar
changelog-guard check-pr \
  --base origin/main \
  --head HEAD \
  --user-facing "src/**,lib/**,packages/**" \
  --ignore "**/*.test.js,**/*.spec.ts"

# Özel atlama kuralları
changelog-guard check-pr \
  --base origin/main \
  --skip-trailer "Changelog: skip" \
  --skip-labels "no-changelog,skip-changelog,dependencies"
```

#### Denetimi Atlama

Eğer yapılan değişiklik bir sürüm notu gerektirmiyorsa (ör. dahili kod temizliği veya bağımlılık güncellemesi):

- **Commit Trailer**: Commit mesajının gövdesine `Changelog: skip` satırı ekleyin:
  ```
  refactor: ayrıştırıcı döngüsünü optimize et

  Changelog: skip
  ```
- **Commit Mesajı Etiketi**: Commit başlığı veya gövdesine `[skip changelog]` ekleyin.
- **PR Etiketleri**: PR üzerine yapılandırılmış etiketlerden birini ekleyin (varsayılan: `no-changelog`, `skip-changelog`, `chore`, `dependencies`). GitHub Actions içinde çalışırken etiketler olay verisinden otomatik algılanır.

### 3. `release`

`[Unreleased]` altındaki değişiklikleri yeni sürüm başlığı altına taşır ve bağlantıları günceller.

```bash
# Günün tarihiyle 1.1.0 sürümünü yayınlar
changelog-guard release 1.1.0

# Belirli bir tarih ile yayınlar
changelog-guard release 1.1.0 --date 2026-10-22

# Dosyaya yazmadan sonucu ekranda görüntüler
changelog-guard release 1.1.0 --dry-run
```

### 4. `init`

Geçerli dizinde standart Keep a Changelog 1.1 şablonu oluşturur.

```bash
changelog-guard init
```

## GitHub Action Entegrasyonu

İş akışlarınıza doğrudan GitHub Action olarak dahil edebilirsiniz:

```yaml
name: Changelog Kontrolü

on:
  pull_request:
    branches: [main]

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - name: Kodu çek
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Changelog Kontrolü Yap
        uses: YusufBeratZengin/changelog-guard@v1
        with:
          mode: 'both' # 'check-pr', 'lint' veya 'both'
          base: ${{ github.base_ref }}
          head: ${{ github.head_ref }}
```

## Programatik API

`changelog-guard`, Node.js ES modülü olarak tüm fonksiyonlarını dışa aktarır:

```javascript
import {
  parseChangelog,
  lintChangelog,
  checkPullRequest,
  executeRelease,
  semver,
  glob
} from 'changelog-guard';

// Metin içeriğini denetleme
const result = lintChangelog(content);
if (!result.valid) {
  console.error(result.diagnostics);
}

// Sürüm oluşturma
const release = executeRelease(content, '1.2.0', { date: '2026-10-22' });
console.log(release.content);
```

## Lisans

MIT - Copyright (c) 2026 Yusuf Berat Zengin. Detaylar için [LICENSE](LICENSE) dosyasına bakınız.
